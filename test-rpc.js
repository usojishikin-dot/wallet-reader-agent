const url = "https://eth-mainnet.g.alchemy.com/v2/Ha2W6A86EG2A03ufE856l";

async function check() {
  console.log("Checking RPC:", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: []
      })
    });
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Response:", data);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

check();
