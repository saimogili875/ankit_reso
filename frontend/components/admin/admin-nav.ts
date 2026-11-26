import {
  LayoutDashboard,
  GraduationCap,
  FolderTree,
  Calendar,
  Video,
  HelpCircle,
  FileText,
  Clock,
  Users,
  CreditCard,
  MessageSquare,
  BarChart2,
  Sliders,
  Image as ImageIcon,
  Bell,
  ShieldCheck,
  Tag,
  Layers,
  BookOpen,
  Package,
  PlusCircle,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short description, shown in the command search */
  hint: string;
  /** Key in the overview payload used for a sidebar badge */
  badgeKey?: 'open_doubts_count';
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, hint: 'Platform totals and quick actions' },
    ],
  },
  {
    title: 'Academics',
    items: [
      { label: 'Courses', href: '/admin/courses', icon: GraduationCap, hint: 'Create courses and course modules' },
      { label: 'Course Content', href: '/admin/course-content', icon: FolderTree, hint: 'Manage sections & items: modules, practice, notes, test series' },
      { label: 'Batches & Pricing', href: '/admin/batches', icon: Layers, hint: 'Manage batches, prices, items and images' },
      { label: 'Pricing Cards', href: '/admin/pricing-cards', icon: Tag, hint: 'Manage landing pricing category cards' },
      { label: 'Curriculum & Modules', href: '/admin/modules', icon: FolderTree, hint: 'Subjects, chapters, lectures and DPPs' },
      { label: 'Schedule', href: '/admin/schedule', icon: Calendar, hint: 'Live classes and daily timetable' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Videos & Media', href: '/admin/videos', icon: Video, hint: 'YouTube and R2 cloud videos' },
      { label: 'Books Catalog', href: '/admin/books', icon: BookOpen, hint: 'Manage books, digital & hardcopy prices' },
      { label: 'Question Bank', href: '/admin/questions', icon: HelpCircle, hint: 'Single, multi and numerical questions' },
      { label: 'Study Materials', href: '/admin/materials', icon: FileText, hint: 'PDFs, notes and handouts' },
      { label: 'CBT Mock Tests', href: '/admin/tests', icon: Clock, hint: 'Build and publish timed tests' },
      { label: 'Add Exam', href: '/admin/tests?create=true', icon: PlusCircle, hint: 'Create an exam (title, duration, marks, questions)' },
    ],
  },
  {
    title: 'Students',
    items: [
      { label: 'Students', href: '/admin/students', icon: Users, hint: 'Accounts, enrolments and progress' },
      { label: 'Payments', href: '/admin/payments', icon: CreditCard, hint: 'Orders, receipts and refunds' },
      { label: 'Book Orders', href: '/admin/book-orders', icon: Package, hint: 'Guest book orders, shipping & tracking' },
      { label: 'Doubt Solver', href: '/admin/doubts', icon: MessageSquare, hint: 'Reply to student doubts', badgeKey: 'open_doubts_count' },
      { label: 'Test Analytics', href: '/admin/test-analytics', icon: BarChart2, hint: 'Scores, accuracy and attempts' },
    ],
  },
  {
    title: 'Website',
    items: [
      { label: 'Home & Slides', href: '/admin/home', icon: Sliders, hint: 'Home carousel and quick access tiles' },
      { label: 'Banner Sliders', href: '/admin/banners', icon: ImageIcon, hint: 'Promotional banners by placement' },
      { label: 'Announcements', href: '/admin/announcements', icon: Bell, hint: 'Notices shown to students' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Roles & RBAC', href: '/admin/roles', icon: ShieldCheck, hint: 'Assign Admin, Teacher, or Student roles' },
      { label: 'Settings', href: '/settings', icon: Settings, hint: 'Appearance, devices and privacy preferences' },
    ],
  },
];

export const allAdminNavItems: AdminNavItem[] = adminNavGroups.flatMap((g) => g.items);

export function isNavActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(pathname: string): { item: AdminNavItem; group: string } | null {
  for (const group of adminNavGroups) {
    for (const item of group.items) {
      if (isNavActive(pathname, item.href)) return { item, group: group.title };
    }
  }
  return null;
}
