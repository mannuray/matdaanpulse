import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getFeedback } from '../../services/feedback.service';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';
import { FEEDBACK_CHANGED_EVENT } from '../../utils/feedback';

const POLL_MS = 60_000;

/** Top-bar bell: count of unread (status=new) public feedback. Only mounted for roles that may open /feedback. */
export function FeedbackBell() {
  const [count, setCount] = useState(0);
  const { editorDirty } = useShellStatus();

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      getFeedback(1, 1, 'new')
        .then((res) => { if (alive) setCount(Number(res?.pagination?.total) || 0); })
        .catch(() => { if (alive) setCount(0); });
    };
    load();
    const t = setInterval(load, POLL_MS);
    window.addEventListener(FEEDBACK_CHANGED_EVENT, load);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(FEEDBACK_CHANGED_EVENT, load);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  const label = `Feedback, ${count} new`;
  return (
    <Link
      to="/feedback"
      aria-label={label}
      title={label}
      onClick={(e) => { if (!confirmDiscardEdits(editorDirty)) e.preventDefault(); }}
      className="relative rounded-control p-1.5 text-ink-2 hover:bg-subtle"
    >
      <Bell size={16} aria-hidden />
      {count > 0 && (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-bad px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
