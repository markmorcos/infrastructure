import sys
import yaml
from typing import Dict, Any

from functions import logger, get_deployment_info, run_command

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

