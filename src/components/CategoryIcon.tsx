import {
  NotebookPen,
  ClipboardList,
  Users,
  Globe,
  GraduationCap,
  BadgeCheck,
  FileText,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "수업": NotebookPen,
  "다중전공": ClipboardList,
  "동아리 & 학회": Users,
  "교환학생": Globe,
  "장학금": GraduationCap,
  "자격증": BadgeCheck,
};

interface Props {
  name: string;
  className?: string;
}

export default function CategoryIcon({ name, className = "w-6 h-6" }: Props) {
  const Icon = iconMap[name] ?? FileText;
  return <Icon className={className} strokeWidth={1.75} />;
}
