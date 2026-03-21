const studentFeatures = [
  'Save time between lectures',
  'No queues during rush hours',
  'Order from anywhere on campus',
  'Fresh and hot pickup experience',
  'Flexible payments support',
  'Simple real-time order tracking'
];

function Features() {
  return (
    <section className="page-section info-page">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Why this is cool for students.</p>
          <h2>Why this is cool for students.</h2>
        </div>
      </div>

      <div className="features-hero">
        <h3>Designed around student schedules, not kitchen queues.</h3>
        <p>
          Canteen Ahead helps students spend less time waiting and more time relaxing, and hanging out with friends.
          It is practical on busy days and still useful during quieter hours.
        </p>
      </div>

      <div className="feature-pill-grid">
        {studentFeatures.map((feature) => (
          <article key={feature} className="feature-pill-card">
            <span className="feature-dot" aria-hidden="true">●</span>
            <p>{feature}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Features;
