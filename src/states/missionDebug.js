import { DEG } from '../util/math.js';
import { compassDeg } from './cockpitData.js';

/** Debug overlay lines for the mission state (F3). */
export function missionDebugLines(st) {
  const m = st.motion;
  const p = m.pose;
  const t = st.world.terrain.stats;
  const ground = st.world.sampler.heightAt(p.x, p.z);
  const hover = st.interaction.hover;
  return [
    `Mission ${st.mission.id}  ${st.mission.theater}/${st.mission.timeOfDay}  walker ${st.walker.id}`,
    `Pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ground ${ground.toFixed(1)}  grade ${m.grade.toFixed(2)}`,
    `Throttle ${m.throttle.value.toFixed(2)}${m.throttle.detentHold ? ' (Raste)' : ''}  speed ${(m.speed * 3.6).toFixed(1)} km/h`,
    `Legs ${compassDeg(m.legYaw).toFixed(0)}°  twist ${(m.twist / DEG).toFixed(1)}°  pitch ${(m.pitch / DEG).toFixed(1)}°`,
    `Head ${(st.view.yaw / DEG).toFixed(0)}/${(st.view.pitch / DEG).toFixed(0)}°  freeLook ${st.view.freeLook ? 'on' : 'off'}  light ${st.cockpit.lightMode}`,
    `Hover ${hover?.id ?? '-'}${hover?.part ? '/' + hover.part : ''}  held ${st.interaction.held?.id ?? '-'}  flood ${st.floodlight.on ? 'on' : 'off'}`,
    `Chunks ${t.chunks} (LOD ${t.perLod.join('/')})  queue ${t.queued}  cam ${st.freeCam ? 'free' : 'cockpit'}`,
    `Entities ${st.entities.count}  View ${st.viewMode}  Wireframe ${st.wireframe ? 'on' : 'off'} [F4]`,
    st.systems.debugLine(),
    `${st.checklist.debugLine()}  Start ${st.startMode}${st.automation.active ? ` · Automatik ${st.automation.currentStep}` : ''}`,
  ];
}
