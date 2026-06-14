// Scaffold templates for a newly provisioned project. The `\${{ ... }}` sequences
// escape JS interpolation so they render as literal GitHub Actions expressions.

export function deployWorkflow(
  project: string,
  repoFull: string,
  configFile: string
): string {
  return `name: deploy-${project}

on:
  workflow_dispatch: {}
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger infrastructure deployment
        uses: peter-evans/repository-dispatch@v2
        with:
          token: \${{ secrets.INFRASTRUCTURE_PAT }}
          repository: markmorcos/infrastructure
          event-type: deploy-${project}
          client-payload: |-
            {
              "repository": "${repoFull}",
              "token": "\${{ secrets.DEPLOYMENT_TOKEN }}",
              "version": "\${{ github.sha }}",
              "config_file": "${configFile}"
            }
`;
}
