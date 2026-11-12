import React, { useState } from 'react';
import { useAdminAuth } from './context/AdminAuthContext';
import { LoginPage } from './pages/LoginPage';
import { Sidebar, AdminTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { MiningPage } from './pages/MiningPage';
import { BiscuitsPage } from './pages/BiscuitsPage';
import { MissionsPage } from './pages/MissionsPage';
import { SpinPage } from './pages/SpinPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { PayoutAutomationPage } from './pages/PayoutAutomationPage';
import { TonConfigPage } from './pages/TonConfigPage';
import { CampaignPage } from './pages/CampaignPage';
import { BroadcastPage } from './pages/BroadcastPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { Crown } from 'lucide-react';

export const App: React.FC = () => {
  const { admin, isLoading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#07040D] text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-2xl shadow-amber-500/30 text-slate-950 mb-4 animate-bounce">
          <Crown className="w-8 h-8 stroke-[2.5]" />
        </div>
        <p className="font-display font-bold text-sm tracking-widest uppercase text-amber-400">
          Loading SuperTom Command Center...
        </p>
      </div>
    );
  }

  if (!admin) {
    return <LoginPage />;
  }

  const tabTitles: Record<AdminTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Command Center Overview',
      subtitle: 'Real-time production economics, player velocity, and withdrawal pipeline.',
    },
    users: {
      title: 'Player Directory & Accounts',
      subtitle: 'Inspect Telegram identities, level milestones, balances, and audit records.',
    },
    mining: {
      title: 'Mining Engine & Production Caps',
      subtitle: 'Configure global base rates, offline accumulation limits, and audit parameters.',
    },
    biscuits: {
      title: 'Biscuit Catalog & Store Pricing',
      subtitle: 'Manage production multiplier treats, pricing, and player inventory boost factors.',
    },
    missions: {
      title: 'Quest & Bounty Operations',
      subtitle: 'Publish, verify, and monitor Telegram community tasks and reward claims.',
    },
    spin: {
      title: 'Lucky Wheel CSPRNG Control',
      subtitle: 'Cryptographic milestone timers (2h/4h/8h) and 100% normalized reward odds.',
    },
    payouts: {
      title: 'Payouts & Player Deposits',
      subtitle: 'TRON TRC20 manual review pipeline, double-action approvals, and txHash auditing.',
    },
    payoutAutomation: {
      title: 'Payout Channel Automation',
      subtitle: 'Reference channel monitoring, adaptive format extraction, and Telegram payout broadcasting.',
    },
    tonConfig: {
      title: 'TON Wallet & Payment Settings',
      subtitle: 'Manage receiving address, TON Connect manifest, network thresholds, and live monitoring.',
    },
    campaign: {
      title: '5K Members Achievement Celebration',
      subtitle: 'Manage 30% instant cashback, tiered daily rewards, participant schedules, and batch disbursements.',
    },
    broadcast: {
      title: 'User Broadcast & Wake-Up Center',
      subtitle: 'Send targeted Telegram bot announcements and pre-built wake-up templates to re-engage players.',
    },
    transactions: {
      title: 'Double-Entry Audit Ledger',
      subtitle: 'Immutable record of every balance debit, credit, and administrative adjustment.',
    },
    referrals: {
      title: 'Referral Tree & Abuse Investigator',
      subtitle: 'Analyze multi-tier player attribution, commission outflows, and bot ring behavior.',
    },
    audit: {
      title: 'Administrator Audit Trail',
      subtitle: 'Trace every administrative change, previous state, new state, and operator IP.',
    },
  };

  return (
    <div className="min-h-screen flex bg-[#07040D] text-slate-100">
      {/* Fixed Left Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Dynamic View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={tabTitles[activeTab].title}
          subtitle={tabTitles[activeTab].subtitle}
        />

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'users' && <UsersPage />}
          {activeTab === 'mining' && <MiningPage />}
          {activeTab === 'biscuits' && <BiscuitsPage />}
          {activeTab === 'missions' && <MissionsPage />}
          {activeTab === 'spin' && <SpinPage />}
          {activeTab === 'payouts' && <PayoutsPage />}
          {activeTab === 'payoutAutomation' && <PayoutAutomationPage />}
          {activeTab === 'tonConfig' && <TonConfigPage />}
          {activeTab === 'campaign' && <CampaignPage />}
          {activeTab === 'broadcast' && <BroadcastPage />}
          {activeTab === 'transactions' && <TransactionsPage />}
          {activeTab === 'referrals' && <ReferralsPage />}
          {activeTab === 'audit' && <AuditLogsPage />}
        </main>
      </div>
    </div>
  );
};

