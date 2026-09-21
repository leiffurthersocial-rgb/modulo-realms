import { useEffect, useRef } from 'react';
import type { Game } from '../game/core/game';
import { getMinimap } from '../game/core/renderer';
import { nextShipStep } from '../game/aegean/guidance';
import { aegeanName } from './aegeanNames';

/** A separate harbour chart reveals directions, never travel or reward receipts. */
export default function ShipComponentChart({ game, requirements }: { game: Game; requirements: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const world = game.maps.get('overworld');
  const steps = requirements.map(id => nextShipStep(game, id));
  useEffect(() => {
    if (!world || !ref.current) return;
    const ctx = ref.current.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const source = getMinimap(world, 2);
    ctx.drawImage(source, 480, 0, 480, 544, 0, 0, 384, 435);
  }, [world]);
  const pos = (tx: number, ty: number) => ({ left: `${(tx - 960) / 960 * 100}%`, top: `${ty / 1088 * 100}%` });
  return <section className="ship-component-chart" aria-label="Ship component map">
    <div className="section-h">Build your ship · {requirements.filter(id => game.campaign.has(id)).length}/{requirements.length} ready</div>
    <div className="ship-chart-grid">
      <div className="ship-chart-map">
        <canvas ref={ref} width={384} height={435} aria-label="Map of Greek component destinations" />
        <span className="ship-chart-north">N ↑</span>
        {steps.map((step, i) => step ? <button key={step.requirement} className={`ship-chart-pin ${game.campaign.state.trackedComponent === step.requirement ? 'selected' : ''}`} style={pos(step.tx, step.ty)}
          title={`${aegeanName(step.requirement)}: ${step.action}`} aria-label={`Track ${aegeanName(step.requirement)}: ${step.action}`}
          onClick={() => game.campaign.trackComponent(step.requirement)}>{i + 1}</button> : null)}
        {game.map.id === 'overworld' && game.player.x >= 960 * 32 ? <span className="ship-chart-you" style={pos(game.player.x / 32, game.player.y / 32)} title="You are here" /> : null}
      </div>
      <div className="ship-chart-steps">
        {requirements.map((id, i) => {
          const step = steps[i];
          const done = game.campaign.has(id);
          return <div className={`ship-component ${done ? 'done' : ''}`} key={id}>
            <strong><span className="ship-step-number">{done ? '✓' : i + 1}</span> {aegeanName(id)}</strong>
            <div>{done ? 'Ready to install' : step?.action ?? 'Complete the marked trial'}</div>
            {!done && step ? <button className="btn small" onClick={() => { game.campaign.trackComponent(id); game.closeAll(); }}>
              {game.campaign.state.trackedComponent === id ? 'Continue route →' : 'Guide me →'}
            </button> : null}
          </div>;
        })}
      </div>
    </div>
    <p className="help-p">Choose a numbered part. Follow the gold arrow; the route updates after each step.</p>
  </section>;
}
