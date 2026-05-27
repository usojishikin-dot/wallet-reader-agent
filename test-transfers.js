const url = "https://eth-mainnet.g.alchemy.com/v2/Ha2W6A86EG2A03ufE856l";
const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth

async function check() {
  console.log("Checking Asset Transfers for:", address);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            toAddress: address,
            category: ["external", "erc20"],
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: "0xa" // 10 txs
          }
        ]
      })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2).substring(0, 500) + "...");
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

check();
