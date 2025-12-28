const FLY_API_URL = 'https://api.machines.dev/v1';

interface CreateMachineOptions {
  appName: string;
  name: string;
  env: Record<string, string>;
  image: string;
}

interface FlyMachine {
  id: string;
  name: string;
  state: string;
}

export async function createFlyApp(name: string): Promise<void> {
  const response = await fetch(`${FLY_API_URL}/apps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_name: name,
      org_slug: process.env.FLY_ORG_SLUG || 'personal',
    }),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Failed to create Fly app: ${await response.text()}`);
  }
}

export async function createMachine(options: CreateMachineOptions): Promise<FlyMachine> {
  const response = await fetch(`${FLY_API_URL}/apps/${options.appName}/machines`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: options.name,
      config: {
        image: options.image,
        env: options.env,
        services: [
          {
            ports: [
              { port: 443, handlers: ['tls', 'http'] },
              { port: 80, handlers: ['http'] },
            ],
            protocol: 'tcp',
            internal_port: 3000,
          },
        ],
        auto_destroy: false,
        restart: { policy: 'on-failure' },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create machine: ${await response.text()}`);
  }

  return response.json();
}

export async function destroyMachine(appName: string, machineId: string): Promise<void> {
  const response = await fetch(
    `${FLY_API_URL}/apps/${appName}/machines/${machineId}?force=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to destroy machine: ${await response.text()}`);
  }
}
