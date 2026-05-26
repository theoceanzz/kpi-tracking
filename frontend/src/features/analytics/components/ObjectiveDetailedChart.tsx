import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ObjectiveDetailedDto } from '@/types/stats'

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ObjectiveDetailedDto;
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl rounded-xl p-5 max-w-sm z-50">
        <div className="font-bold text-slate-900 dark:text-slate-200 mb-1 leading-tight">{data.name}</div>
        <div className="text-[11px] font-mono text-slate-500 mb-4 bg-slate-100 dark:bg-slate-800/50 inline-block px-1.5 rounded">{data.code}</div>
        
        <div className="flex gap-2 items-center mb-1">
           <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đơn vị:</span>
           <span className="text-sm font-medium text-slate-800 dark:text-slate-300">{data.unitName}</span>
        </div>
        <div className="text-[11px] text-slate-500 mb-4 font-mono pl-11">{data.unitCode}</div>
        
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-white/5 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 text-center leading-tight">Tỉ lệ hoàn thành</div>
            <div className="text-xl font-bold text-emerald-500 dark:text-emerald-400">{Math.round(data.progress)}%</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-white/5 p-3 rounded-lg flex flex-col items-center justify-center">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 text-center leading-tight">Hiệu suất</div>
            <div className="text-xl font-bold text-blue-500 dark:text-blue-400">{Math.round(data.performance)}%</div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] font-medium text-slate-400 dark:text-slate-500 text-center uppercase tracking-wider">
          Nhấn vào cột để xem chi tiết
        </div>
      </div>
    )
  }
  return null;
}

interface Props {
  data: ObjectiveDetailedDto[];
  onBarClick: (data: ObjectiveDetailedDto) => void;
}

export default function ObjectiveDetailedChart({ data, onBarClick }: Props) {
  return (
    <div className="w-full h-[620px] bg-white dark:bg-slate-900/40 backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/10 p-6 shadow-sm dark:shadow-xl flex flex-col">
      {/* Nhãn đơn vị đo nằm ngang ở phía trên */}
      <div className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 pl-3">
        (%) Tỷ lệ
      </div>

      <div className="flex-1 min-h-[470px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 20, bottom: 80 }}
          >
            <defs>
              <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#059669" stopOpacity={1}/>
              </linearGradient>
              <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#2563eb" stopOpacity={1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#64748b" 
              fontSize={12} 
              tickMargin={15}
              tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val}
              angle={-30}
              textAnchor="end"
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={12}
              tickFormatter={(val) => `${Math.round(val)}%`}
              domain={[0, 'auto']}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: '#94a3b8', opacity: 0.1 }} 
              isAnimationActive={false}
            />
          <Legend 
            verticalAlign="bottom"
            align="center"
            layout="horizontal"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingTop: '30px', fontSize: 12, fontWeight: 500 }}
          />
          <Bar 
            name="Tỉ lệ hoàn thành" 
            dataKey="progress" 
            fill="url(#colorProgress)" 
            radius={[4, 4, 0, 0]}
            onClick={(data) => onBarClick(data.payload)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            barSize={40}
          />
          <Bar 
            name="Hiệu suất" 
            dataKey="performance" 
            fill="url(#colorPerformance)" 
            radius={[4, 4, 0, 0]}
            onClick={(data) => onBarClick(data.payload)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            barSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
