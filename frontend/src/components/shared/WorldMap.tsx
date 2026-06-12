import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { useTheme } from '@/contexts/ThemeContext'
import { useState } from 'react'
import { getCountryName } from '@/lib/countries'

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'

interface WorldMapProps {
  countryData: Array<{ country: string; total: number }>
}

export function WorldMap({ countryData }: WorldMapProps) {
  const { theme } = useTheme()
  const [tooltip, setTooltip] = useState<{ name: string; count: number } | null>(null)

  const countryMap = countryData.reduce((acc, item) => {
    acc[item.country.toUpperCase()] = item.total
    return acc
  }, {} as Record<string, number>)

  const alphaToNumeric: Record<string, string> = {
    'US': '840', 'CA': '124', 'GB': '826', 'DE': '276', 'FR': '250',
    'IT': '380', 'ES': '724', 'NL': '528', 'SE': '752', 'NO': '578',
    'DK': '208', 'FI': '246', 'IE': '372', 'BE': '056', 'AT': '040',
    'CH': '756', 'PL': '616', 'CZ': '203', 'HU': '348', 'RO': '642',
    'BG': '100', 'HR': '191', 'SI': '705', 'SK': '703', 'EE': '233',
    'LV': '428', 'LT': '440', 'CN': '156', 'JP': '392', 'KR': '410',
    'IN': '356', 'ID': '360', 'MY': '458', 'SG': '702', 'TH': '764',
    'VN': '704', 'PH': '608', 'AU': '036', 'NZ': '554', 'BR': '076',
    'MX': '484', 'AR': '032', 'CL': '152', 'CO': '170', 'PE': '604',
    'ZA': '710', 'EG': '818', 'DZ': '012', 'MA': '504', 'NG': '566',
    'KE': '404', 'AE': '784', 'SA': '682', 'QA': '634', 'KW': '414',
    'OM': '512', 'BH': '048', 'IQ': '368', 'JO': '400', 'LB': '422',
    'TR': '792', 'RU': '643', 'UA': '804', 'KZ': '398', 'UZ': '860',
    'LK': '144', 'BD': '050', 'PK': '586', 'BN': '096', 'KH': '116',
    'LA': '418', 'MM': '104', 'TL': '626', 'HK': '344', 'MO': '446',
    'TW': '158', 'IR': '364', 'IL': '376', 'PS': '275', 'LY': '434',
    'TN': '788', 'EH': '732', 'DJ': '262', 'ET': '231', 'SO': '706',
    'UG': '800', 'TZ': '834', 'MW': '454', 'MZ': '508', 'ZM': '894',
    'ZW': '716', 'BW': '072', 'NA': '516', 'LS': '426', 'SZ': '748',
    'SC': '690', 'MU': '480', 'KM': '174', 'MG': '450', 'RE': '638',
  }

  const smallCountryCoordinates: Record<string, [number, number]> = {
    'SG': [103.8198, 1.3521],
    'HK': [114.1694, 22.3193],
    'MO': [113.5439, 22.1987],
    'BN': [114.7277, 4.5353],
    'BH': [50.5577, 26.0667],
    'QA': [51.1839, 25.3548],
    'KW': [47.4818, 29.3117],
    'LB': [35.8623, 33.8547],
  }

  const top3CountriesAlpha = countryData.slice(0, 3).map(c => c.country.toUpperCase())

  const top3Countries = countryData.slice(0, 3).map(c => {
    const alpha = c.country.toUpperCase()
    const numeric = alphaToNumeric[alpha]
    return numeric
  }).filter(Boolean)

  const top3CountriesInt = top3Countries.map(c => parseInt(c))

  const numericToAlpha: Record<string, string> = {
    '840': 'US', '124': 'CA', '826': 'GB', '276': 'DE', '250': 'FR',
    '380': 'IT', '724': 'ES', '528': 'NL', '752': 'SE', '578': 'NO',
    '208': 'DK', '246': 'FI', '372': 'IE', '056': 'BE', '040': 'AT',
    '756': 'CH', '616': 'PL', '203': 'CZ', '348': 'HU', '642': 'RO',
    '100': 'BG', '191': 'HR', '705': 'SI', '703': 'SK', '233': 'EE',
    '428': 'LV', '440': 'LT', '156': 'CN', '392': 'JP', '410': 'KR',
    '356': 'IN', '360': 'ID', '458': 'MY', '702': 'SG', '764': 'TH',
    '704': 'VN', '608': 'PH', '036': 'AU', '554': 'NZ', '076': 'BR',
    '484': 'MX', '032': 'AR', '152': 'CL', '170': 'CO', '604': 'PE',
    '710': 'ZA', '818': 'EG', '012': 'DZ', '504': 'MA', '566': 'NG',
    '404': 'KE', '784': 'AE', '682': 'SA', '634': 'QA', '414': 'KW',
    '512': 'OM', '048': 'BH', '368': 'IQ', '400': 'JO', '422': 'LB',
    '792': 'TR', '643': 'RU', '804': 'UA', '398': 'KZ', '860': 'UZ',
    '144': 'LK', '050': 'BD', '586': 'PK', '096': 'BN', '116': 'KH',
    '418': 'LA', '104': 'MM', '626': 'TL', '344': 'HK', '446': 'MO',
    '158': 'TW', '364': 'IR', '376': 'IL', '275': 'PS', '434': 'LY',
    '788': 'TN', '732': 'EH', '262': 'DJ', '231': 'ET', '706': 'SO',
    '800': 'UG', '834': 'TZ', '454': 'MW', '508': 'MZ', '894': 'ZM',
    '716': 'ZW', '072': 'BW', '516': 'NA', '426': 'LS', '748': 'SZ',
    '690': 'SC', '480': 'MU', '174': 'KM', '450': 'MG', '638': 'RE',
  }

  const maxValue = Math.max(...countryData.map(c => c.total), 1)

  const getCountryColor = (total: number) => {
    const intensity = total / maxValue
    if (theme === 'dark') {
      return `rgba(107, 174, 245, ${0.3 + intensity * 0.3})`
    }
    return `rgba(107, 174, 245, ${0.25 + intensity * 0.35})`
  }

  const handleMouseEnter = (geo: any) => () => {
    const countryCode = geo.id
    const countryName = geo.properties?.name || getCountryName(countryCode)
    
    const alphaCode = numericToAlpha[countryCode] || countryCode || ''
    const total = countryMap[alphaCode.toUpperCase()] || countryMap[countryCode] || 0
    
    setTooltip({
      name: countryName,
      count: total
    })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      {tooltip && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
          <div className={`px-4 py-2.5 rounded-lg shadow-lg border backdrop-blur-sm ${
            theme === 'dark' 
              ? 'bg-slate-800/95 border-slate-700 text-slate-100' 
              : 'bg-white/95 border-slate-200 text-slate-900'
          }`}>
            <p className="text-sm font-semibold">{tooltip.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{tooltip.count.toLocaleString()} requests</p>
          </div>
        </div>
      )}
      
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [0, 20]
        }}
        width={800}
        height={400}
        style={{ width: '100%', height: 'auto', maxHeight: '100%' }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: any[] }) => {
            return geographies.map((geo: any) => {
              const countryCode = geo.id
              const alphaCode = numericToAlpha[countryCode] || countryCode || ''
              const total = countryMap[alphaCode.toUpperCase()] || countryMap[countryCode] || 0
              
              const isTop3Country = top3Countries.includes(String(countryCode)) || 
                                   top3CountriesInt.includes(countryCode)
              
              const defaultFill = isTop3Country 
                ? getCountryColor(total)
                : (theme === 'dark' ? '#1e293b' : '#e2e8f0')
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={defaultFill}
                  stroke={theme === 'dark' ? '#334155' : '#cbd5e1'}
                  strokeWidth={0.3}
                  onMouseEnter={handleMouseEnter(geo)}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    default: { outline: 'none' },
                    hover: { 
                      fill: theme === 'dark' ? 'rgba(107, 174, 245, 0.7)' : 'rgba(107, 174, 245, 0.6)',
                      outline: 'none',
                      cursor: 'pointer'
                    },
                    pressed: { outline: 'none' }
                  }}
                />
              )
            })
          }}
        </Geographies>
        
        {top3CountriesAlpha.map(alpha => {
          const coords = smallCountryCoordinates[alpha]
          if (!coords) return null
          
          const countryInfo = countryData.find(c => c.country.toUpperCase() === alpha)
          if (!countryInfo) return null
          
          return (
            <Marker key={alpha} coordinates={coords}>
              <circle
                r={6}
                fill={theme === 'dark' ? 'rgba(107, 174, 245, 0.35)' : 'rgba(107, 174, 245, 0.3)'}
                stroke={theme === 'dark' ? 'rgba(107, 174, 245, 0.2)' : 'rgba(107, 174, 245, 0.15)'}
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTooltip({
                  name: getCountryName(alpha),
                  count: countryInfo.total
                })}
                onMouseLeave={() => setTooltip(null)}
              />
            </Marker>
          )
        })}
      </ComposableMap>
    </div>
  )
}
