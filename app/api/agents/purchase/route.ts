import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Default: 5 tokens = $0.05 (fits within buyer's $0.1 session limit)
    const { token_count = 5 } = body;

    if (!agentManager.isInitialized()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agents not initialized. Call /api/agents/initialize first.' 
      }, { status: 400 });
    }

    await agentManager.triggerPurchase(token_count);

    return NextResponse.json({ 
      success: true, 
      message: `Purchase triggered for ${token_count} tokens` 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
