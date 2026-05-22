import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, ShieldAlert, Ghost, Search, HelpCircle } from 'lucide-react';

interface ErrorPageProps {
  code?: '403' | '404' | '500';
  title?: string;
  message?: string;
}

const ERROR_CONFIG = {
  '403': {
    title: 'Access Denied',
    subTitle: '403 Forbidden',
    message: 'Bạn không có quyền truy cập vào tài nguyên này. Đây là khu vực hạn chế.',
    icon: ShieldAlert,
    themeColor: 'from-rose-500 to-orange-500',
    iconColor: 'text-rose-500',
    bgColor: 'bg-rose-50/50',
    darkBgColor: 'dark:bg-rose-950/10'
  },
  '404': {
    title: 'Page Not Found',
    subTitle: '404 Error',
    message: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được chuyển sang địa chỉ mới.',
    icon: Ghost,
    themeColor: 'from-blue-600 to-cyan-500',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50/50',
    darkBgColor: 'dark:bg-blue-950/10'
  },
  '500': {
    title: 'Internal Server Error',
    subTitle: '500 Error',
    message: 'Đã có lỗi xảy ra từ phía máy chủ. Chúng tôi đang nhanh chóng khắc phục.',
    icon: Search,
    themeColor: 'from-amber-500 to-orange-600',
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-50/50',
    darkBgColor: 'dark:bg-amber-950/10'
  }
};

const ErrorPage: React.FC<ErrorPageProps> = ({ code = '404' }) => {
  const navigate = useNavigate();
  const config = ERROR_CONFIG[code] || ERROR_CONFIG['404'];
  const Icon = config.icon;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-slate-950 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
      
      {/* Premium Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br ${config.themeColor} blur-[120px] opacity-[0.07] animate-pulse`} />
        <div className={`absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr ${config.themeColor} blur-[100px] opacity-[0.05]`} style={{ animationDelay: '2s' }} />
        
        {/* Fine grid pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-100" />
      </div>

      <div className="relative z-10 max-w-2xl w-full px-6 text-center space-y-12">
        {/* Header Section */}
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
          <div className="flex justify-center">
            <div className={`relative p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800/50`}>
              <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${config.themeColor} opacity-5 blur-xl`} />
              <Icon className={`w-12 h-12 ${config.iconColor}`} style={{ filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.2))' }} />
            </div>
          </div>
          
          <div className="space-y-2">
            <span className={`inline-block text-sm font-bold tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r ${config.themeColor}`}>
              {config.subTitle}
            </span>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight">
              {config.title}
            </h1>
          </div>
          
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            {config.message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-in fade-in slide-in-from-bottom-12 delay-300 duration-1000 fill-mode-both">
          <button
            onClick={() => navigate(-1)}
            className="group relative flex items-center justify-center px-8 py-4 w-full sm:w-auto rounded-2xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Quay lại
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="group relative flex items-center justify-center px-8 py-4 w-full sm:w-auto rounded-2xl font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-slate-200 dark:shadow-none"
          >
            <Home className="mr-2 h-5 w-5" />
            Về trang chủ
          </button>
        </div>

        {/* Footer info/links */}
        <div className="pt-12 border-t border-slate-100 dark:border-slate-900 flex flex-wrap justify-center gap-8 animate-in fade-in delay-700 duration-1000 fill-mode-both">
          <a href="/help" className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <HelpCircle className="h-4 w-4" />
            Trợ giúp
          </a>
          <a href="/report-issue" className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <Search className="h-4 w-4" />
            Báo lỗi hệ thống
          </a>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
