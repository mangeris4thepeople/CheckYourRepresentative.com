import React, { useState, useMemo } from 'react';

/*
BillSidebar

Drop-in replacement for the "SELECT A BILL" list on the Accountability page.
Adds four filter tabs above the bill list: All bills, Previous bills, Voted on, Not voted on.

Props:
  bills: array of bill objects, each shaped like:
    {
      id: string,
      billNumber: string,   e.g. "HR-5744"
      positionCount: number, the badge count shown on the button
      isActive: boolean,     true for currently active legislation, false for closed/past bills
    }

  userVotes: object map of billId -> "support" | "oppose" | "undecided"
  selectedBillId: string, the id of the bill currently shown in the detail panel
  onSelectBill: function(billId) => void, called when a bill button is clicked
*/

const FILTERS = {
  ALL: 'all',
  PREVIOUS: 'previous',
  VOTED: 'voted',
  NOT_VOTED: 'not_voted',
};

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

export default function BillSidebar({ bills, userVotes = {}, selectedBillId, onSelectBill }) {
  const [filter, setFilter] = useState(FILTERS.ALL);

  const visibleBills = useMemo(
    () => filterBills(bills, userVotes, filter),
    [bills, userVotes, filter]
  );

  return (
    <div className="bs-wrapper">
      <div className="bs-heading">Select a bill</div>

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
        {visibleBills.length === 0 && (
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
    </div>
  );
}
