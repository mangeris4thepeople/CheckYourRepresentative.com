import React, { useState, useMemo } from 'react';

/*
BillsView

Props:
  bills: array of bill objects, each shaped like:
    {
      id: string,
      billNumber: string,        e.g. "HR-8002"
      title: string,
      summary: string,
      sponsor: string,           e.g. "Sen. Cruz, Ted (R-TX)"
      whoBenefits: string,
      whoWorseOff: string,
      pacMoney: string,
      industries: string,
      impact: string,
      isActive: boolean,         true for currently active legislation, false for closed/past bills
      voteTally: { yes: number, no: number, total: number }
    }

  userVotes: object map of billId -> "support" | "oppose" | "undecided"
  currentUserId: string, used only to know if the user is logged in
  onCastVote: function(billId, position) => void, called when the user picks a position
*/

const FILTERS = {
  ALL: 'all',
  VOTED: 'voted',
  NOT_VOTED: 'not_voted',
};

function filterBills(bills, userVotes, filter) {
  switch (filter) {
    case FILTERS.VOTED:
      return bills.filter((bill) => Boolean(userVotes[bill.id]));
    case FILTERS.NOT_VOTED:
      return bills.filter((bill) => !userVotes[bill.id]);
    default:
      return bills;
  }
}

function VoteTallyBar({ voteTally }) {
  if (!voteTally || !voteTally.total) return null;
  const yesPct = Math.round((voteTally.yes / voteTally.total) * 100);
  return (
    <div className="bv-section">
      <div className="bv-label">What the country has voted</div>
      <div className="bv-tally-row">
        <div className="bv-tally-track">
          <div className="bv-tally-yes" style={{ width: `${yesPct}%` }} />
          <div className="bv-tally-no" style={{ width: `${100 - yesPct}%` }} />
        </div>
        <span className="bv-tally-caption">
          {yesPct}% yes &middot; {voteTally.total.toLocaleString()} votes
        </span>
      </div>
    </div>
  );
}

function YourPosition({ billId, currentPosition, onCastVote }) {
  const options = [
    { key: 'support', label: 'Support' },
    { key: 'oppose', label: 'Oppose' },
    { key: 'undecided', label: 'Undecided' },
  ];
  return (
    <div className="bv-section">
      <div className="bv-label">Your position</div>
      <div className="bv-position-row">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={
              currentPosition === opt.key
                ? `bv-position-btn bv-position-btn-active-${opt.key}`
                : 'bv-position-btn'
            }
            onClick={() => onCastVote(billId, opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CollapsibleRow({ icon, label, tone, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bv-row bv-row-${tone}`}>
      <button
        type="button"
        className="bv-row-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{icon} {label}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="bv-row-body">{children}</div>}
    </div>
  );
}

export default function BillsView({ bills, userVotes = {}, onCastVote }) {
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [index, setIndex] = useState(0);

  const visibleBills = useMemo(
    () => filterBills(bills, userVotes, filter),
    [bills, userVotes, filter]
  );

  const clampedIndex = Math.min(index, Math.max(visibleBills.length - 1, 0));
  const activeBill = visibleBills[clampedIndex];

  function selectFilter(nextFilter) {
    setFilter(nextFilter);
    setIndex(0);
  }

  function goNext() {
    setIndex((prev) => Math.min(prev + 1, visibleBills.length - 1));
  }

  function goPrevious() {
    setIndex((prev) => Math.max(prev - 1, 0));
  }

  return (
    <div className="bv-wrapper">
      <div className="bv-tabbar-container">
        <div className="bv-tabbar-label">Select a bill to vote on</div>
        <div className="bv-tabbar">
          <button
            type="button"
            className={filter === FILTERS.ALL ? 'bv-tab bv-tab-active' : 'bv-tab'}
            onClick={() => selectFilter(FILTERS.ALL)}
          >
            All bills
          </button>
          <button type="button" className="bv-tab" onClick={goNext}>
            Next bill
          </button>
          <button type="button" className="bv-tab" onClick={goPrevious}>
            Previous bills
          </button>
          <button
            type="button"
            className={filter === FILTERS.VOTED ? 'bv-tab bv-tab-active' : 'bv-tab'}
            onClick={() => selectFilter(FILTERS.VOTED)}
          >
            Voted on
          </button>
          <button
            type="button"
            className={filter === FILTERS.NOT_VOTED ? 'bv-tab bv-tab-active' : 'bv-tab'}
            onClick={() => selectFilter(FILTERS.NOT_VOTED)}
          >
            Not voted on
          </button>
        </div>
      </div>

      {!activeBill && (
        <div className="bv-card bv-empty">No bills match this filter yet.</div>
      )}

      {activeBill && (
        <div className="bv-card">
          <div className="bv-kicker">
            Active legislation &middot; {clampedIndex + 1} of {visibleBills.length}
          </div>
          <h3 className="bv-title">{activeBill.title}</h3>
          <p className="bv-summary">{activeBill.summary}</p>

          <div className="bv-sponsor">
            <div className="bv-label">Introduced by</div>
            <div className="bv-sponsor-name">{activeBill.sponsor}</div>
          </div>

          <CollapsibleRow icon="✔" label="Who benefits if this passes" tone="success">
            {activeBill.whoBenefits}
          </CollapsibleRow>
          <CollapsibleRow icon="✖" label="Who is worse off if this passes" tone="danger">
            {activeBill.whoWorseOff}
          </CollapsibleRow>
          <CollapsibleRow icon="$" label="PAC and donor money behind this bill" tone="warning">
            {activeBill.pacMoney}
          </CollapsibleRow>
          <CollapsibleRow icon="#" label="Industries with financial stake" tone="accent">
            {activeBill.industries}
          </CollapsibleRow>

          <VoteTallyBar voteTally={activeBill.voteTally} />

          <YourPosition
            billId={activeBill.id}
            currentPosition={userVotes[activeBill.id]}
            onCastVote={onCastVote}
          />

          <div className="bv-section bv-impact">
            <div className="bv-label">If this passes, what changes for you</div>
            <div className="bv-impact-text">{activeBill.impact}</div>
          </div>

          <div className="bv-nav-row">
            <button
              type="button"
              className="bv-nav-btn"
              onClick={goPrevious}
              disabled={clampedIndex === 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="bv-nav-btn"
              onClick={goNext}
              disabled={clampedIndex >= visibleBills.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
