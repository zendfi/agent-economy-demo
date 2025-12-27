import { NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export async function POST() {
  try {
    await agentManager.initializeAgents();
    return NextResponse.json({ 
      success: true, 
      message: 'Agents initialized successfully' 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
