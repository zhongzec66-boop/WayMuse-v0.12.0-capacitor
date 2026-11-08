import {
  ArrowLeft,
  CloudOff,
  GraduationCap,
  HardDrive,
  Mic,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { APP_VERSION } from "../version";

const sections = [
  {
    icon: <HardDrive />,
    title: "数据保存在何处",
    body: "称呼、WayMuse 头像、自定义助理人格、学校、专业、年级、主要课程、课程、任务、记忆和是否完成首次进入，都只保存在当前设备的浏览器存储中。没有账户，也没有云端副本。",
  },
  {
    icon: <GraduationCap />,
    title: "WayMuse 头像与学业档案",
    body: "WayMuse 头像由你主动选择，浏览器会裁成 256px JPEG 后只存本机；学校、专业、年级和主要课程也只存本机。只有你开启“带入本机资料”并发送消息时，这些档案才会作为上下文发送给 DeepSeek。",
  },
  {
    icon: <Mic />,
    title: "文件与录音",
    body: "文件、图片和语音只在当前页面预览。保存资料时只记录文件名和你的备注，不保存文件内容，也不会上传、识别或转写。录音需要麦克风权限，停止后不会离开设备。",
  },
  {
    icon: <Sparkles />,
    title: "可选：聊天页的 DeepSeek 接入",
    body: "只有你在聊天页或设置中填写自己的 API Key、连接 DeepSeek 并发送消息时，对话内容和自定义助理人格才会发送到 api.deepseek.com；你选择带入的本机资料也会一同发送。密钥默认只保存在本次会话；勾选“记住密钥”后会写入本机。不连接 DeepSeek 时，聊天页不会发起任何 AI 请求。",
  },
  {
    icon: <CloudOff />,
    title: "默认没有连接什么",
    body: "当前版本没有登录、云端同步、课表识别或第三方应用授权，也没有分析或广告 SDK。“连接应用”中的服务全部标注为“规划中”。除了你主动使用的聊天页 DeepSeek 接入，没有其他外部数据接收方。",
  },
  {
    icon: <ShieldCheck />,
    title: "你的控制",
    body: "你可以在设置中单独删除课程和记忆，也可以使用“清除全部数据”一次性删除本机数据并回到首次进入。卸载 App 或清除浏览器数据同样会删除这些内容。",
  },
  {
    icon: <Trash2 />,
    title: "未来接入服务时",
    body: "如果以后接入账户、云端同步、课表导入、日历或正式 AI 服务，我们会在上线前更新这份说明，并在读取新数据前重新征求你的授权。",
  },
];

export default function PrivacyPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="wr-settings-page wr-privacy-page">
      <div className="wr-settings-top">
        <button className="wr-round" aria-label="返回" onClick={onClose}>
          <ArrowLeft />
        </button>
        <h1>隐私与数据</h1>
        <span />
      </div>
      <div className="wr-settings-scroll">
        <div className="wr-privacy-intro">
          <ShieldCheck size={26} />
          <p>资料默认保存在本机。外部连接需要你主动开启。</p>
        </div>
        {sections.map(({ icon, title, body }) => (
          <section className="wr-privacy-section" key={title}>
            <div className="wr-privacy-title">
              {icon}
              <h2>{title}</h2>
            </div>
            <p>{body}</p>
          </section>
        ))}
        <section className="wr-privacy-section">
          <div className="wr-privacy-title">
            <ShieldCheck />
            <h2>联系开发者</h2>
          </div>
          <p>
            上架后可通过 App Store 产品页的“App
            支持”链接联系开发者。当前没有客服系统或账户注销入口，因为还没有创建账户。
          </p>
        </section>
        <p className="wr-privacy-foot">
          最后更新：2026-11-06 · 版本 {APP_VERSION}
        </p>
      </div>
    </div>
  );
}
