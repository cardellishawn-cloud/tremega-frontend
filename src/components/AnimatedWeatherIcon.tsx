import { motion } from 'framer-motion'

interface AnimatedWeatherIconProps {
  condition: string
  size?: number
  className?: string
}

export function AnimatedWeatherIcon({ condition, size = 64, className = '' }: AnimatedWeatherIconProps) {
  const iconColor = '#4A7FDB'
  const sunColor = '#F39C12'
  const cloudColor = '#95A5A6'
  const rainColor = '#3498DB'
  const snowColor = '#ECF0F1'

  const renderIcon = () => {
    switch (condition.toLowerCase()) {
      case 'clear':
      case 'sunny':
        return (
          <motion.svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            className={className}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <circle cx="32" cy="32" r="14" fill={sunColor} />
            {[...Array(8)].map((_, i) => (
              <motion.line
                key={i}
                x1="32"
                y1="8"
                x2="32"
                y2="14"
                stroke={sunColor}
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${i * 45} 32 32)`}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </motion.svg>
        )

      case 'partly-cloudy':
        return (
          <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
            <motion.circle
              cx="24"
              cy="24"
              r="10"
              fill={sunColor}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.path
              d="M20 44 Q20 34 30 34 Q34 26 44 26 Q56 26 56 38 Q56 48 46 48 L26 48 Q20 48 20 44"
              fill={cloudColor}
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </svg>
        )

      case 'cloudy':
      case 'clouds':
        return (
          <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
            <motion.path
              d="M12 40 Q12 30 22 30 Q26 20 38 20 Q52 20 52 34 Q52 44 42 44 L20 44 Q12 44 12 40"
              fill={cloudColor}
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            <motion.path
              d="M24 52 Q24 46 32 46 Q36 40 44 40 Q54 40 54 48 Q54 54 46 54 L30 54 Q24 54 24 52"
              fill={cloudColor}
              opacity="0.7"
              animate={{ x: [0, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
            />
          </svg>
        )

      case 'rain':
      case 'drizzle':
        return (
          <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
            <motion.path
              d="M14 32 Q14 22 24 22 Q28 14 40 14 Q54 14 54 28 Q54 38 44 38 L22 38 Q14 38 14 32"
              fill={cloudColor}
            />
            {[...Array(5)].map((_, i) => (
              <motion.line
                key={i}
                x1={20 + i * 6}
                y1="42"
                x2={18 + i * 6}
                y2="54"
                stroke={rainColor}
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], y: [0, 8] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </svg>
        )

      case 'thunderstorm':
        return (
          <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
            <motion.path
              d="M14 30 Q14 20 24 20 Q28 12 40 12 Q54 12 54 26 Q54 36 44 36 L22 36 Q14 36 14 30"
              fill={cloudColor}
            />
            <motion.polygon
              points="32,38 26,50 32,50 28,62 40,46 34,46 38,38"
              fill="#F1C40F"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </svg>
        )

      case 'snow':
        return (
          <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
            <motion.path
              d="M14 32 Q14 22 24 22 Q28 14 40 14 Q54 14 54 28 Q54 38 44 38 L22 38 Q14 38 14 32"
              fill={cloudColor}
            />
            {[...Array(6)].map((_, i) => (
              <motion.circle
                key={i}
                cx={18 + i * 5}
                cy={44 + (i % 2) * 6}
                r="2"
                fill={snowColor}
                animate={{ y: [0, 12], opacity: [1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </svg>
        )

      case 'atmosphere':
      case 'fog':
      case 'mist':
        return (
          <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
            {[...Array(4)].map((_, i) => (
              <motion.line
                key={i}
                x1="12"
                y1={24 + i * 10}
                x2="52"
                y2={24 + i * 10}
                stroke={cloudColor}
                strokeWidth="4"
                strokeLinecap="round"
                animate={{ x: [0, 5, 0], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </svg>
        )

      default:
        return (
          <motion.svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            className={className}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <circle cx="32" cy="32" r="14" fill={sunColor} />
          </motion.svg>
        )
    }
  }

  return renderIcon()
}

export default AnimatedWeatherIcon
