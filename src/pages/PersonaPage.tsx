import { ChevronRight, Settings2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { UserProfile } from "../profile";
import type { Overlay, Page } from "../types";

export default function PersonaPage({
  profile,
  agentName,
  agentAvatar,
  setOverlay,
  nav,
}: {
  profile: UserProfile;
  agentName: string;
  agentAvatar: string;
  setOverlay: Dispatch<SetStateAction<Overlay>>;
  nav: (page: Page) => void;
}) {
  return (
    <>
      <div className="wr-head">
        <h1>你的 {agentName}</h1>
        <button
          className="wr-round"
          aria-label="编辑资料"
          onClick={() => setOverlay("设置")}
        >
          <Settings2 />
        </button>
      </div>
      <div className="wr-persona">
        <div className="wr-persona-orb">
          <img src={agentAvatar || "/avatar.svg"} alt="" />
        </div>
        <h2>{agentName}</h2>
        <p>
          {profile.companionType} · {profile.tone} · {profile.responseLength}
          回复
        </p>
      </div>
      <div className="wr-persona-card">
        <h3>一起探索你的大学生活</h3>
        <p>
          {profile.school.trim() || "你的学校"}
          {profile.major.trim() ? ` · ${profile.major.trim()}` : ""} ·{" "}
          {profile.grade}
        </p>
        <p>记住目标，参考真实经历，帮你把想做的事变成下一步行动。</p>
        <button onClick={() => nav("聊天")}>
          开始聊聊 <ChevronRight size={18} />
        </button>
      </div>
    </>
  );
}
