/* Authorized Protocol Quality Assurance & Formal Invariant Verification */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const report = await req.json();
    console.warn('[CSP Violation Report]:', JSON.stringify(report['csp-report'] || report));
    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }
}
