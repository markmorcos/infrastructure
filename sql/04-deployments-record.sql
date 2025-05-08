INSERT INTO deployments (project_name, repository_name, config, token)
VALUES (
  'portfolio',
  'markmorcos/portfolio',
  '{
    "chartVersion": "0.1.9",
    "projectName": "portfolio",
    "ingress": {
      "host": "mark.onthewifi.com", 
      "path": "/",
      "pathType": "Prefix"
    },
    "deployment": {
      "image": "markmorcos/portfolio",
      "tag": "latest"
    },
    "service": {
      "port": 80
    }
  }',
  'TOKEN'
);
