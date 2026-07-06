import React, { useState, useEffect, useCallback, useMemo } from 'react';

/*
BillSidebar

The "SELECT A BILL" list on the Accountability page. Self-contained: it fetches
its own prefix tabs (every bill type with any votes, via /api/matrix?mode=
prefixes) and, for the selected tab, that type's bills 20 at a time (via
/api/matrix?mode=byPrefix), with a Load More button. This replaces the old
approach of the parent handing down a single capped top-100-nationally list,
so every voted-on bill is reachable, not just the most active ones.

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

  return (
    <div className="bs-wrapper">
      <div className="bs-heading">Select a bill</div>

      {prefixesPhase === 'ready' && (
        <div className="bs-prefix-row">
          {prefixes.map((p) => (
            <button
              key={p.bill_type}
              type="button"
              className={activePrefix === p.bill_type ? 'bs-prefix-tab bs-prefix-tab-active' : 'bs-prefix-tab'}
              onClick={() => setActivePrefix(p.bill_type)}
            >
              {String(p.bill_type).toUpperCase()} {p.bill_count}
            </button>
          ))}
        </div>
      )}

      <div className="bs-filter-row">
        <button
          type="button"
          className={filter === FILTERS.ALL ? 'bs-filter-tab bs-filter-tab-active' : 'bs-filter-tab'}
          onClick={() => setFilter(FILTERS.ALL)}
        >
          All bills
        </button>
        <button
          type="button"
          className={filter === FILTERS.PREVIOUS ? 'bs-filter-tab bs-filter-tab-active' : 'bs-filter-tab'}
          onClick={() => setFilter(FILTERS.PREVIOUS)}
        >
          Previous bills
        </button>
        <button
          type="button"
          className={filter === FILTERS.VOTED ? 'bs-filter-tab bs-filter-tab-active' : 'bs-filter-tab'}
          onClick={() => setFilter(FILTERS.VOTED)}
        >
          Voted on
        </button>
        <button
          type="button"
          className={filter === FILTERS.NOT_VOTED ? 'bs-filter-tab bs-filter-tab-active' : 'bs-filter-tab'}
          onClick={() => setFilter(FILTERS.NOT_VOTED)}
        >
          Not voted on
        </button>
      </div>

      <div className="bs-list">
        {listPhase === 'loading' && bills.length === 0 && (
          <div className="bs-empty">Loading bills...</div>
        )}
        {listPhase === 'error' && (
          <div className="bs-empty">Could not load bills.</div>
        )}
        {listPhase === 'ready' && visibleBills.length === 0 && (
          <div className="bs-empty">No bills match this filter.</div>
        )}
        {visibleBills.map((bill) => (
          <button
            key={bill.id}
            type="button"
            className={
              bill.id === selectedBillId ? 'bs-bill-btn bs-bill-btn-active' : 'bs-bill-btn'
            }
            onClick={() => onSelectBill(bill.id)}
          >
            <span>{bill.billNumber}</span>
            <span className="bs-bill-count">{bill.positionCount}</span>
          </button>
        ))}
      </div>

      {listPhase === 'ready' && hasMore && (
        <button
          type="button"
          className="bs-load-more"
          onClick={() => loadBills(activePrefix, offset + PAGE_SIZE, true)}
        >
          Load More
        </button>
      )}
      {listPhase === 'loading' && bills.length > 0 && (
        <div className="bs-empty" style={{ textAlign: 'center' }}>Loading more...</div>
      )}
    </div>
  );
}
