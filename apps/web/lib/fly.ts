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

function validateFlyToken(token: string): void {
  // Fly token prefixes:
  // - fo1_ : Personal Access Token (full API access)
  // - fm2_ : Machine-specific token (limited to specific app)
  // - FlyV1 : Deploy token (for flyctl deploy)

  if (token.startsWith('fm2_')) {
    console.warn(
      'WARNING: FLY_API_TOKEN appears to be a Machine-specific token (fm2_). ' +
      'These tokens can only operate on a specific app and cannot create new apps. ' +
      'For full API access, use a Personal Access Token (fo1_) instead. ' +
      'Generate one at: https://fly.io/user/personal_access_tokens'
    );
  }

  if (token.startsWith('FlyV1 ')) {
    throw new Error(
      'FLY_API_TOKEN appears to be a Deploy token (FlyV1). ' +
      'Deploy tokens cannot be used with the Machines API. ' +
      'Please use a Personal Access Token (fo1_) instead. ' +
      'Generate one at: https://fly.io/user/personal_access_tokens'
    );
  }
}

function getFlyAuthHeaders(): Record<string, string> {
  const token = process.env.FLY_API_TOKEN;

  if (!token) {
    throw new Error('FLY_API_TOKEN environment variable is not set');
  }

  // Validate token format
  validateFlyToken(token);

  // Log token prefix for debugging (safe - only shows first 10 chars)
  const tokenPrefix = token.substring(0, 10);
  console.log(`Using Fly API token starting with: ${tokenPrefix}...`);

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function createFlyApp(name: string): Promise<void> {
  const orgSlug = process.env.FLY_ORG_SLUG || 'personal';
  console.log(`Creating Fly app "${name}" in org "${orgSlug}"`);

  const response = await fetch(`${FLY_API_URL}/apps`, {
    method: 'POST',
    headers: getFlyAuthHeaders(),
    body: JSON.stringify({
      app_name: name,
      org_slug: orgSlug,
    }),
  });

  if (!response.ok && response.status !== 409) {
    const responseText = await response.text();
    console.error(`Fly API error - Status: ${response.status}, Response: ${responseText}`);

    if (response.status === 401) {
      throw new Error(
        `Fly API authentication failed (401). Please verify your FLY_API_TOKEN is valid and has not expired. ` +
        `Token should be a Fly.io API token (usually starting with 'fo1_' for personal access tokens). ` +
        `API response: ${responseText}`
      );
    }

    throw new Error(`Failed to create Fly app: ${responseText}`);
  }

  if (response.status === 409) {
    console.log(`Fly app "${name}" already exists, continuing...`);
  } else {
    console.log(`Fly app "${name}" created successfully`);
  }
}

export async function createMachine(options: CreateMachineOptions): Promise<FlyMachine> {
  console.log(`Creating Fly machine "${options.name}" in app "${options.appName}"`);

  const response = await fetch(`${FLY_API_URL}/apps/${options.appName}/machines`, {
    method: 'POST',
    headers: getFlyAuthHeaders(),
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
    const responseText = await response.text();
    console.error(`Fly API error creating machine - Status: ${response.status}, Response: ${responseText}`);

    if (response.status === 401) {
      throw new Error(
        `Fly API authentication failed when creating machine (401). ` +
        `Please verify your FLY_API_TOKEN. API response: ${responseText}`
      );
    }

    throw new Error(`Failed to create machine: ${responseText}`);
  }

  const machine = await response.json();
  console.log(`Fly machine created successfully with ID: ${machine.id}`);
  return machine;
}

export async function destroyMachine(appName: string, machineId: string): Promise<void> {
  console.log(`Destroying Fly machine "${machineId}" in app "${appName}"`);

  const headers = getFlyAuthHeaders();
  // DELETE doesn't need Content-Type
  delete headers['Content-Type'];

  const response = await fetch(
    `${FLY_API_URL}/apps/${appName}/machines/${machineId}?force=true`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok && response.status !== 404) {
    const responseText = await response.text();
    console.error(`Fly API error destroying machine - Status: ${response.status}, Response: ${responseText}`);

    if (response.status === 401) {
      throw new Error(
        `Fly API authentication failed when destroying machine (401). ` +
        `Please verify your FLY_API_TOKEN. API response: ${responseText}`
      );
    }

    throw new Error(`Failed to destroy machine: ${responseText}`);
  }

  if (response.status === 404) {
    console.log(`Machine "${machineId}" not found (may have already been destroyed)`);
  } else {
    console.log(`Machine "${machineId}" destroyed successfully`);
  }
}
