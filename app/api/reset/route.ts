import { NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';
import { agentStore } from '@/lib/store';

export async function POST() {
  try {
    agentManager.reset();
    
    return NextResponse.json({ 
      success: true, 
      message: 'System reset successfully' 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
