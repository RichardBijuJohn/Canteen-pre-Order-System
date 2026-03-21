function About() {
  return (
    <section className="page-section info-page">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">About The Platform</p>
          <h2>How this works in 3 steps.</h2>
        </div>
      </div>

      <div className="steps-grid">
        <article className="step-card">
          <span className="step-index">1</span>
          <h3>Order</h3>
          <p>Choose your food, set quantity, and place your pre-order instantly from your phone or laptop.</p>
        </article>
        <article className="step-card">
          <span className="step-index">2</span>
          <h3>Wait</h3>
          <p>The kitchen prepares your meal while you stay in class, lab, or with your team.</p>
        </article>
        <article className="step-card">
          <span className="step-index">3</span>
          <h3>Pickup</h3>
          <p>Get notified when your order is ready and pick it up without standing in a long queue.</p>
        </article>
      </div>

      <div className="problem-panel">
        <p className="eyebrow">Problem Statement</p>
        <h3>Students lose valuable break time in canteen lines.</h3>
        <p>
          During peak hours, students often spend most of their short break waiting to order. This causes delayed meals,
          missed social time, and stress before the next class. Canteen Ahead solves this by shifting ordering to a digital flow
          so students can plan ahead and collect food quickly.
        </p>
      </div>
    </section>
  );
}

export default About;
