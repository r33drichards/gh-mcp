import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { destroyMachine } from '@/lib/fly';

const FLY_APP_NAME = process.env.FLY_MCP_APP_NAME || 'gh-mcp-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get the MCP URL record
  const { data: mcpUrl, error: fetchError } = await supabase
    .from('mcp_urls')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.userId)
    .single();

  if (fetchError || !mcpUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // Destroy the Fly machine
    await destroyMachine(FLY_APP_NAME, mcpUrl.fly_machine_id);

    // Mark as revoked
    const { error: updateError } = await supabase
      .from('mcp_urls')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to mark URL as revoked:', updateError);
      // Machine is already destroyed, but we should still report the database error
      return NextResponse.json({ error: 'Machine destroyed but failed to update database' }, { status: 500 });
    }

    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (error) {
    console.error('Error revoking MCP URL:', error);
    return NextResponse.json({ error: 'Failed to revoke URL' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(request, { params });
}
