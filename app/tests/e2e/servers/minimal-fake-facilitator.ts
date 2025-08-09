import http, { IncomingMessage, ServerResponse } from 'node:http';

type VerifyPayload = {
  x402Version: number;
  paymentPayload: any;
  paymentRequirements: any;
};

type SettlePayload = VerifyPayload;

export async function startFakeFacilitator(port: number) {
  const seenNonces = new Set<string>();

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${port}`);
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      await new Promise<void>((r) => req.on('end', () => r()));
      const bodyStr = Buffer.concat(chunks).toString('utf8') || '{}';
      const body = JSON.parse(bodyStr);

      // Pattern: /{network}/verify or /{network}/settle
      const [, network, action] = url.pathname.split('/');
      if (!network || (action !== 'verify' && action !== 'settle')) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      if (action === 'verify') {
        const payload = body as VerifyPayload;
        const reqs = payload.paymentRequirements;
        const maxAmount = BigInt(reqs.maxAmountRequired ?? reqs[0]?.maxAmountRequired ?? '0');
        const asset = (reqs.asset ?? reqs[0]?.asset) as string | undefined;
        const reqNetwork = (reqs.network ?? reqs[0]?.network) as string | undefined;

        const sent = payload.paymentPayload?.payload?.authorization?.value ?? '0';
        const nonce = payload.paymentPayload?.payload?.authorization?.nonce ?? '0x00';
        const validNetwork = reqNetwork && network && reqNetwork === network;

        // Underpayment
        if (BigInt(sent) < maxAmount) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ success: false, errorReason: 'underpayment' }));
          return;
        }
        // Wrong network
        if (!validNetwork) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ success: false, errorReason: 'wrong_network' }));
          return;
        }
        // Replay check
        if (seenNonces.has(nonce)) {
          res.statusCode = 409;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ success: false, errorReason: 'replay' }));
          return;
        }

        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (action === 'settle') {
        const payload = body as SettlePayload;
        const nonce = payload.paymentPayload?.payload?.authorization?.nonce ?? '0x00';
        if (seenNonces.has(nonce)) {
          res.statusCode = 409;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ success: false, errorReason: 'replay' }));
          return;
        }
        seenNonces.add(nonce);

        const txHash = '0x' + Buffer.from(nonce).toString('hex').slice(0, 64).padEnd(64, '0');
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ success: true, transaction: txHash }));
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    } catch (e) {
      res.statusCode = 500;
      res.end(String(e));
    }
  });

  await new Promise<void>((resolve) => server.listen(port, () => resolve()));

  return {
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}


