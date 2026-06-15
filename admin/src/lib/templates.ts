export interface EnvVar {
  name: string;
  value: string;
}

export interface StackOpts {
  project: string;
  namespace: string;
  port: number;
  ingressHost: string;
  env: EnvVar[];
}

export interface Stack {
  id: string;
  label: string;
  defaultPort: number;
  ingress: boolean;
  // path -> file content (Dockerfile + minimal buildable starter app)
  files(o: StackOpts): Record<string, string>;
}

const CHART_VERSION = "0.8.0";

// Chart-shaped deployment.yaml shared by every stack.
export function deploymentYaml(o: StackOpts, withIngress: boolean): string {
  const env = o.env.filter((e) => e.name);
  const envBlock = env.length
    ? "    env:\n" +
      env
        .map((e) => `      - name: ${e.name}\n        value: ${JSON.stringify(e.value)}`)
        .join("\n") +
      "\n"
    : "";
  const ingressBlock =
    withIngress && o.ingressHost
      ? `    ingress:\n      host: ${o.ingressHost}\n      path: /\n      pathType: Prefix\n`
      : "";
  return `version: ${CHART_VERSION}

namespace: ${o.namespace}
project: ${o.project}

services:
  - name: ${o.project}
    image: ghcr.io/markmorcos/${o.project}
    context: .
    port: ${o.port}
${envBlock}${ingressBlock}`;
}

const STACKS: Record<string, Stack> = {
  nextjs: {
    id: "nextjs",
    label: "Next.js (web)",
    defaultPort: 3000,
    ingress: true,
    files: (o) => ({
      "package.json": JSON.stringify(
        {
          name: o.project,
          private: true,
          scripts: { build: "next build", start: `next start -p ${o.port}` },
          dependencies: { next: "15.3.1", react: "^19.0.0", "react-dom": "^19.0.0" },
          devDependencies: {
            typescript: "^5.7.3",
            "@types/node": "^22.10.5",
            "@types/react": "^19.0.7",
            "@types/react-dom": "^19.0.3",
          },
        },
        null,
        2
      ),
      // Ship a tsconfig so `next build` doesn't auto-install the latest TypeScript
      // and generate a default `moduleResolution: node10` config that TS6 rejects.
      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: { "@/*": ["./*"] },
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        },
        null,
        2
      ),
      ".gitignore": "node_modules\n.next\nnpm-debug.log*\n",
      "next.config.mjs": "export default {};\n",
      "app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
      "app/page.tsx": `export default function Page() {
  return <main style={{ fontFamily: "system-ui", padding: 40 }}>Hello from ${o.project} 👋</main>;
}
`,
      Dockerfile: `FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE ${o.port}
CMD ["npm", "start"]
`,
    }),
  },

  go: {
    id: "go",
    label: "Go (api)",
    defaultPort: 8080,
    ingress: true,
    files: (o) => ({
      "go.mod": `module ${o.project}\n\ngo 1.22\n`,
      "main.go": `package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "${o.port}"
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "Hello from ${o.project}")
	})
	http.ListenAndServe(":"+port, nil)
}
`,
      Dockerfile: `FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app .

FROM alpine:3.20
COPY --from=build /app /app
EXPOSE ${o.port}
ENV PORT=${o.port}
CMD ["/app"]
`,
    }),
  },

  node: {
    id: "node",
    label: "Node (api)",
    defaultPort: 8080,
    ingress: true,
    files: (o) => ({
      "package.json": JSON.stringify(
        { name: o.project, private: true, scripts: { start: "node index.js" } },
        null,
        2
      ),
      "index.js": `const http = require("http");
const port = process.env.PORT || ${o.port};
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello from ${o.project}\\n");
  })
  .listen(port, () => console.log("listening on " + port));
`,
      Dockerfile: `FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE ${o.port}
ENV PORT=${o.port}
CMD ["node", "index.js"]
`,
    }),
  },

  static: {
    id: "static",
    label: "Static / Astro",
    defaultPort: 80,
    ingress: true,
    files: (o) => ({
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${o.project}</title>
    <style>body{font-family:system-ui;padding:40px}</style>
  </head>
  <body>
    <h1>Hello from ${o.project}</h1>
  </body>
</html>
`,
      Dockerfile: `FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
`,
    }),
  },
};

export const STACK_LIST = Object.values(STACKS).map((s) => ({
  id: s.id,
  label: s.label,
  defaultPort: s.defaultPort,
}));

export function getStack(id: string): Stack | undefined {
  return STACKS[id];
}
