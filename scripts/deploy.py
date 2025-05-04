import sys
import os
import json
import subprocess
import base64
import logging
import yaml
import psycopg2
from psycopg2.extensions import connection
from psycopg2.extras import DictCursor
from typing import List, Optional, Tuple, Dict, Any

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

def get_secret(name: str, key: str) -> str:
    """
    Retrieve a Kubernetes secret value.
    
    Args:
        name: Name of the secret
        key: Key within the secret
        
    Returns:
        Decoded secret value
        
    Raises:
        subprocess.CalledProcessError: If kubectl command fails
        json.JSONDecodeError: If secret value is not valid JSON
        KeyError: If key not found in secret data
    """
    try:
        result = subprocess.run(
            ["kubectl", "-n", "infrastructure", "get", "secret", name, "-o", "json"],
            check=True, capture_output=True, text=True
        )
        secret_json = json.loads(result.stdout)
        return base64.b64decode(secret_json["data"][key]).decode()
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to get secret {name}/{key}: {e.stderr}")
        raise
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to parse secret {name}/{key}: {str(e)}")
        raise

def get_database_credentials() -> Dict[str, str]:
    """
    Get database connection credentials from Kubernetes secrets.
    
    Returns:
        Dictionary with database connection parameters (dbname, user, password, host)
        
    Raises:
        SystemExit: If unable to read database secrets
    """
    try:
        return {
            "dbname": get_secret("database-secrets", "DATABASE"),
            "user": get_secret("database-secrets", "USER"),
            "password": get_secret("database-secrets", "PASSWORD"),
            "host": get_secret("database-secrets", "HOST")
        }
    except Exception as e:
        logger.error(f"Failed to read database secrets: {e}")
        sys.exit(1)

def get_database_connection() -> connection:
    """
    Get a database connection using credentials from Kubernetes secrets.
    
    Returns:
        PostgreSQL database connection
        
    Raises:
        SystemExit: If unable to establish database connection
    """
    try:
        db_credentials = get_database_credentials()
        return psycopg2.connect(**db_credentials)
    except psycopg2.Error as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)

def get_deployment_token() -> str:
    """
    Get the deployment token from the environment.
    
    Returns:
        Value of DEPLOYMENT_TOKEN environment variable
    """
    return os.getenv("DEPLOYMENT_TOKEN")

def get_deployment_info() -> Optional[Dict[str, Any]]:
    """
    Retrieve deployment information from database using deployment token.
    
    Returns:
        Dictionary containing deployment data if found and enabled, None otherwise
        
    Raises:
        KeyError: If DEPLOYMENT_TOKEN environment variable is not set
    """
    token = get_deployment_token()
    if not token: raise KeyError("DEPLOYMENT_TOKEN environment variable is required")

    conn = get_database_connection()
    with conn.cursor(cursor_factory=DictCursor) as cursor:
        cursor.execute("SELECT * FROM deployments WHERE token = %s", (token,))
        deployment = cursor.fetchone()
        
    if deployment is None:
        logger.error("Deployment not found")
        return None
        
    if not deployment["enabled"]:
        logger.error("Deployment is not enabled")
        return None
        
    return dict(deployment)

def run_command(cmd: List[str], input_text: Optional[str] = None) -> Tuple[bool, str]:
    """
    Run a shell command and handle the result.
    
    Args:
        cmd: List of command arguments to execute
        input_text: Optional text to pass to command's stdin
        
    Returns:
        Tuple of (success: bool, output: str) where output contains stdout on success
        or stderr on failure
    """
    logger.info(f"Running command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            input=input_text,
            check=False
        )
        
        if result.returncode != 0:
            logger.error(f"Command failed: {result.stderr}")
            return False, result.stderr
        
        return True, result.stdout
    except Exception as e:
        logger.error(f"Exception running command: {str(e)}")
        return False, str(e)

def deploy_with_helm(project_name: str, config: Dict[str, Any]) -> bool:
    """
    Deploy application using Helm.
    
    Args:
        project_name: Name of the project
        config: Configuration for Helm chart
        
    Returns:
        True if deployment successful
    """
    yaml_config = yaml.dump(config)
    
    cmd = [
        "helm", "upgrade", "--install", project_name,
        "oci://registry-1.docker.io/markmorcos/base-chart",
        "--version", config["chartVersion"],
        "-f", "-",
        "-n", project_name,
        "--create-namespace"
    ]
    
    success, = run_command(cmd, input_text=yaml_config)
    if success:
        logger.info(f"Successfully deployed {project_name} with Helm")
    
    return success

def main() -> int:
    """
    Main function to orchestrate the deployment process.
    
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    
    deployment = get_deployment_info()
    if not deployment: return 1
    
    logger.info(f"Starting deployment for {deployment['project_name']} version {deployment['version']}")
    
    deployed = deploy_with_helm(deployment['project_name'], deployment['config'])
    if not deployed: return 1
    
    logger.info(f"Deployment of {deployment['project_name']} version {deployment['version']} completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())

