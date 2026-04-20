import { 
  GitBranch, 
  ChevronRight, 
  Building2 
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OrgUnitTreeResponse } from '../types/org-unit'

interface SubUnitListProps {
  units: OrgUnitTreeResponse[]
}

export function SubUnitList({ units }: SubUnitListProps) {
  const navigate = useNavigate()

  if (units.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
        <GitBranch className="w-5 h-5 mr-3 text-blue-600" />
        Đơn vị trực thuộc ({units.length})
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.map(child => (
          <div 
            key={child.id}
            onClick={() => navigate(`/org-units/${child.id}`)}
            className="group p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <Building2 className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 line-clamp-1">{child.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{child.type}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        ))}
      </div>
    </div>
  )
}
