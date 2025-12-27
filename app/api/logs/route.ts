import { NextResponse } from 'next/server';
import { agentStore } from '@/lib/store';

export async function GET() {
  try {
    const logs = agentStore.getLogs();
    
    return NextResponse.json({ 
      success: true, 
      logs: logs.map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
