import { AppShell } from '@/components/app-shell';
import { TaxView } from '@/components/tax/tax-view';
import { TaxMobile } from '@/components/mobile/panels/tax-mobile';

export const metadata = {
  title: 'Atrium · Tax',
  description: 'Realised gains by jurisdiction. Auditor-grade CSV + PDF + signed Merkle proof.',
};

export default function TaxPage() {
  return (
    <AppShell
      active="/app/tax"
      breadcrumb={[
        { label: 'Tax' },
        { label: 'Tablet · exports' },
      ]}
    >
      {/* Audit fix (#74): mobile gets the thumb-friendly tax dashboard panel.
          Audit fix (#45 regression): md:hidden wrapper (guards all panel branches). */}
      <div className="md:hidden"><TaxMobile /></div>
      <div className="hidden md:block">
      <TaxView />

      <p className="mt-8 text-[10px] uppercase tracking-wider text-muted">
        Atrium is not a tax advisor. Export is a calculation aid intended for review by a qualified accountant.
        Signed Merkle root proves the export was produced from the same dataset that Lantern attested for the relevant block.
      </p>
      </div>
    </AppShell>
  );
}
