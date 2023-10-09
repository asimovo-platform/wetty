import _ from 'lodash';
import { overlay } from './disconnect/elements';
import { verifyPrompt } from './disconnect/verify';

export function disconnect(reason: string): void {
  console.log("Wetty disconnect called:", reason)
  if (_.isNull(overlay)) return;
  overlay.style.display = 'block';
  const msg = document.getElementById('msg');
  if (!_.isUndefined(reason) && !_.isNull(msg)) msg.innerHTML = reason;
  window.removeEventListener('beforeunload', verifyPrompt, false);
}
