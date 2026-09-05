import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, Briefcase, MapPin } from 'lucide-react'

interface HeroSectionProps {
  jobName?: string
  jobLocation?: string
  crewCount?: number
  totalHours?: number
  status?: string
}

export function HeroSection({
  jobName = 'Select a Job',
  jobLocation = '',
  crewCount = 0,
  totalHours = 0,
  status = 'In Progress',
}: HeroSectionProps) {
  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1F3A93 0%, #4A7FDB 100%)',
        minHeight: '280px',
      }}
    >
      {/* Animated background overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-2"
          >
            Daily Job Report
          </motion.h1>

          {/* Date */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-blue-100 mb-6"
          >
            {dateString}
          </motion.p>

          {/* Job Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center gap-4 mb-8"
          >
            <div className="flex items-center gap-2 text-white">
              <Briefcase className="h-5 w-5" />
              <span className="text-xl font-medium">{jobName}</span>
            </div>
            {jobLocation && (
              <div className="flex items-center gap-2 text-blue-100">
                <MapPin className="h-4 w-4" />
                <span>{jobLocation}</span>
              </div>
            )}
          </motion.div>

          {/* Stats Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap gap-3"
          >
            <Badge
              variant="secondary"
              className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Crew: {crewCount}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Hours: {totalHours}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-green-500/30 text-white border-green-400/30 px-4 py-2 text-sm"
            >
              {status}
            </Badge>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

export default HeroSection
