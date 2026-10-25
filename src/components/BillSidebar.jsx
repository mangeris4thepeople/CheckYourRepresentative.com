import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BILL_TYPE_LEGEND } from '../content/siteCopy.js';
import { Panel, Seg, TallyBar, Loading, Empty } from './ui/Kit.jsx';

/*
BillSidebar

The "Select a bill" picker on the Accountability page. Self-contained: it fetches
its own prefix tabs (every bill type with any votes, via /api/matrix?mode=
prefixes) and, for the selected tab, that type's bills 20 at a time (via
/api/matrix?mode=byPrefix), with a Load More button. This replaces the old
approach of the parent handing down a single capped top-100-nationally list,
so every voted-on bill is reachable, not just the most active ones.

October 2026 redesign: a Panel with Seg pills for bill types and filters, and
full-width rows (no cramped 200px rail on phones). Styles in BillSidebar.css.

Props:
  userVotes: object map of billId -> "support" | "oppose" | "undecided"
  selectedBillId: string, the id of the bill currently shown in the detail panel
  onSelectBill: function(billId) => void, called when a bill button is clicked,
    and also when a tab's list first loads, to pick a sensible default.
*/

const FILTERS = {
  ALL: 'all',
  PREVIOUS: 'previous',
  VOTED: 'voted',
  NOT_VOTED: 'not_voted',
};
const PAGE_SIZE = 20;

function filterBills(bills, userVotes, filter) {
  switch (filter) {
    case FILTERS.PREVIOUS:
      return bills.filter((bill) => !bill.isActive);
    case FILTERS.VOTED:
      return bills.filter((bill) => Boolean(userVotes[bill.id]));
    case FILTERS.NOT_VOTED:
      return bills.filter((bill) => !userVotes[bill.id]);
    default:
      return bills;
  }
}

export default function BillSidebar({ userVotes = {}, selectedBillId, onSelectBill }) {
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [legendOpen, setLegendOpen] = useState(false);

  const [prefixes, setPrefixes] = useState([]);
  const [prefixesPhase, setPrefixesPhase] = useState('loading'); // loading|ready|empty|error
  const [activePrefix, setActivePrefix] = useState(null);

  const [bills, setBills] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [listPhase, setListPhase] = useState('loading'); // loading|ready|error

  // Load the tab list once. Highest-count tab is the default.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/matrix?mode=prefixes')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = d.prefixes || [];
        setPrefixes(list);
        setPrefixesPhase(list.length ? 'ready' : 'empty');
        if (list.length) setActivePrefix(list[0].bill_type);
      })
      .catch(() => { if (!cancelled) setPrefixesPhase('error'); });
    return () => { cancelled = true; };
  }, []);

  const loadBills = useCallback(async (prefix, newOffset, append) => {
    if (!prefix) return;
    setListPhase('loading');
    try {
      const p = new URLSearchParams({
        mode: 'byPrefix', prefix, limit: String(PAGE_SIZE), offset: String(newOffset),
      });
      const r = await fetch(`/api/matrix?${p}`);
      const d = await r.json();
      const mapped = (d.rows || []).map((row) => ({
        id: row.bill_id,
        billNumber: String(row.bill_id).replace(/-119$/, '').toUpperCase(),
        positionCount: Number(row.total_votes) || 0,
        // Display only: lets each row draw its support / oppose bar.
        supportCount: Number(row.support_votes) || 0,
        opposeCount: Number(row.oppose_votes) || 0,
        isActive: true,
      }));
      setBills((prev) => (append ? [...prev, ...mapped] : mapped));
      setOffset(d.offset ?? newOffset);
      setHasMore(!!d.hasMore);
      setListPhase('ready');
      // Pick a default bill whenever a tab's list first loads, so the detail
      // panel always has something to show for the newly selected tab.
      if (!append && mapped.length) onSelectBill(mapped[0].id);
    } catch {
      setListPhase('error');
    }
  }, [onSelectBill]);

  useEffect(() => {
    if (activePrefix) loadBills(activePrefix, 0, false);
  }, [activePrefix, loadBills]);

  const visibleBills = useMemo(
    () => filterBills(bills, userVotes, filter),
    [bills, userVotes, filter]
  );

  // Only show legend entries for bill types that actually have a tab, so an
  // empty database (or one without, say, concurrent resolutions yet) never
  // shows rows for types that aren't present.
  const visibleLegend = useMemo(() => {
    const present = new Set(prefixes.map((p) => String(p.bill_type).toUpperCase()));
    return BILL_TYPE_LEGEND.filter((item) => present.has(item.code));
  }, [prefixes]);

  return (
    <Panel
      className="bs-wrapper"
      eyebrow="Bill picker"
      title="Select a bill"
      pad={0}
      action={visibleLegend.length > 0 ? (
        <button
          type="button"
          className="bs-legend-toggle"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((o) => !o)}
        >
          <span aria-hidden>{legendOpen ? '▾' : '?'}</span> What do these mean?
        </button>
      ) : null}
    >
      {visibleLegend.length > 0 && legendOpen && (
        <div className="bs-legend-body">
          {visibleLegend.map((item) => (
            <div key={item.code} className="bs-legend-row">
              <span className="bs-legend-code">{item.code}</span>
              <span>
                <span className="bs-legend-name">{item.name}.</span>{' '}
                <span className="bs-legend-desc">{item.desc}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bs-controls">
        {prefixesPhase === 'loading' && <div className="cyr-skeleton" style={{ height: 40, borderRadius: 999 }} />}
        {prefixesPhase === 'ready' && (
          <div className="bs-seg">
            <div className="bs-label">Bill type</div>
            <Seg
              wrap
              value={activePrefix}
              onChange={setActivePrefix}
              options={prefixes.map((p) => ({
                value: p.bill_type,
                label: String(p.bill_type).toUpperCase(),
                count: p.bill_count,
              }))}
            />
          </div>
        )}

        <div className="bs-seg bs-seg-filters">
          <div className="bs-label">Show</div>
          <Seg
            wrap
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: FILTERS.ALL, label: 'All bills' },
              { value: FILTERS.PREVIOUS, label: 'Previous bills' },
              { value: FILTERS.VOTED, label: 'Voted on' },
              { value: FILTERS.NOT_VOTED, label: 'Not voted on' },
            ]}
          />
        </div>
      </div>

      <div className="bs-list" role="listbox" aria-label="Bills">
        {(listPhase === 'loading' || prefixesPhase === 'loading') && bills.length === 0 && prefixesPhase !== 'error' && prefixesPhase !== 'empty' && (
          <Loading rows={5} height={54} />
        )}
        {(listPhase === 'error' || prefixesPhase === 'error') && (
          <div className="bs-empty bs-empty-error">Could not load bills.</div>
        )}
        {prefixesPhase === 'empty' && (
          <Empty icon="🗂️" title="No bills yet">No bill has a position on it yet.</Empty>
        )}
        {listPhase === 'ready' && visibleBills.length === 0 && (
          <div className="bs-empty">No bills match this filter.</div>
        )}
        {visibleBills.map((bill) => {
          const active = bill.id === selectedBillId;
          const senate = bill.billNumber.startsWith('S');
          return (
            <button
              key={bill.id}
              type="button"
              role="option"
              aria-selected={active}
              className={active ? 'bs-bill-btn bs-bill-btn-active' : 'bs-bill-btn'}
              onClick={() => onSelectBill(bill.id)}
            >
              <span className={senate ? 'bs-bill-num bs-bill-num-senate' : 'bs-bill-num'}>
                {bill.billNumber.replace('-', ' ')}
              </span>
              <span className="bs-bill-bar">
                <TallyBar
                  support={bill.supportCount}
                  oppose={bill.opposeCount}
                  other={Math.max(0, bill.positionCount - bill.supportCount - bill.opposeCount)}
                  height={6}
                />
              </span>
              <span className="bs-bill-count">
                <span className="cyr-num">{bill.positionCount}</span>
                <span className="bs-bill-count-label">{bill.positionCount === 1 ? 'position' : 'positions'}</span>
              </span>
            </button>
          );
        })}
      </div>

      {listPhase === 'ready' && hasMore && (
        <div className="bs-more">
          <button
            type="button"
            className="cyr-btn cyr-btn-ghost bs-load-more"
            onClick={() => loadBills(activePrefix, offset + PAGE_SIZE, true)}
          >
            Load more
          </button>
        </div>
      )}
      {listPhase === 'loading' && bills.length > 0 && (
        <div className="bs-empty" style={{ textAlign: 'center' }}>Loading more...</div>
      )}
    </Panel>
  );
}
