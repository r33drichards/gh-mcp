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

/**
 * Check if the configured token is a machine-specific token (fm2_).
 * Machine tokens can only operate on an existing app, not create new apps.
 *
 * Token formats:
 * - fm2_... : Direct machine token
 * - FlyV1 fm2_... : Macaroon-wrapped machine token
 */
export function isMachineToken(): boolean {
  const token = process.env.FLY_API_TOKEN;
  if (!token) return false;

  // Check for direct machine token or macaroon-wrapped machine token
  return token.startsWith('fm2_') || token.startsWith('FlyV1 fm2_');
}

function validateFlyToken(token: string): void {
  // Fly token formats:
  // - fo1_ : Personal Access Token (full API access)
  // - fm2_ : Machine-specific token (limited to specific app)
  // - FlyV1 fm2_... : Macaroon-wrapped machine token
  // - FlyV1 fo1_... : Macaroon-wrapped personal access token

  if (isMachineToken()) {
    console.log(
      'Using Machine-specific token (fm2_). App creation will be skipped - ' +
      'ensure the app already exists in Fly.io.'
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

  // Log token prefix for debugging (safe - only shows first 15 chars)
  const tokenPrefix = token.substring(0, 15);
  console.log(`Using Fly API token starting with: ${tokenPrefix}...`);

  // FlyV1 tokens (macaroon format) should be used directly without "Bearer" prefix
  // Regular tokens (fo1_, fm2_) need the "Bearer" prefix
  const authHeader = token.startsWith('FlyV1 ') ? token : `Bearer ${token}`;

  return {
    Authorization: authHeader,
    'Content-Type': 'application/json',
  };
}

export async function createFlyApp(name: string): Promise<void> {
  // Machine tokens (fm2_) cannot create apps - they can only operate on existing apps
  // Skip app creation if using a machine token
  if (isMachineToken()) {
    console.log(`Using machine token - skipping app creation. App "${name}" must already exist.`);
    return;
  }

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
        `Token should be a Fly.io API token (fo1_ for personal access tokens, or fm2_ for machine tokens). ` +
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
