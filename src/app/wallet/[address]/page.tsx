import WalletDashboard from "@/components/WalletDashboard";

export default async function WalletPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  // Pass the address from the URL to the dashboard
  return <WalletDashboard initialAddress={address} />;
}
