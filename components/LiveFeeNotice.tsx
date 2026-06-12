const EXAMPLES = [
  { viewers: "100 viewers", cost: "$1/hr after hour 1" },
  { viewers: "500 viewers", cost: "$5/hr after hour 1" },
  { viewers: "1,000 viewers", cost: "$10/hr after hour 1" },
  { viewers: "5,000 viewers", cost: "$50/hr after hour 1" },
];

export default function LiveFeeNotice() {
  return (
    <div className="fee-live" style={{ marginBottom: 32 }}>
      <p className="fee-live-title">Live Streaming</p>
      <p className="fee-live-body">
        Your first hour of every live stream is <strong>always free</strong>. After that:{" "}
        <strong>$0.01 per viewer per hour</strong>, billed in 15-minute increments, because streaming at scale has real infrastructure costs.
      </p>
      <div className="live-examples">
        {EXAMPLES.map((e) => (
          <div className="live-ex" key={e.viewers}>
            <span className="live-ex-v">{e.viewers}</span>
            <span className="live-ex-c">{e.cost}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
