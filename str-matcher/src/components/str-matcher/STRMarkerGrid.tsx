import React, { useState } from 'react';
import { ChevronDown, BrainCircuit } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface STRMarkerGridProps {
  onMarkerChange?: (marker: string, value: string) => void;
  initialMarkers?: Record<string, string>;
  onRemoveMarker?: (marker: string) => void;
}

// Карта для выделения маркеров разными цветами в зависимости от группы
const markerColorMap: Record<string, string> = {
  DYS: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700',
  YCAII: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700',
  'Y-GATA': 'from-green-50 to-green-100 border-green-200 text-green-700',
  CDY: 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
  DYF: 'from-rose-50 to-rose-100 border-rose-200 text-rose-700',
};

// Получение цветового класса на основе префикса маркера
const getMarkerColorClass = (markerName: string): string => {
  for (const prefix in markerColorMap) {
    if (markerName.startsWith(prefix)) {
      return markerColorMap[prefix];
    }
  }
  return 'from-gray-50 to-gray-100 border-gray-200 text-gray-700';
};

interface MarkerPanelProps {
  title: string;
  subTitle: string;
  markers: { name: string; value: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onMarkerChange?: (marker: string, value: string) => void;
  panelIcon?: string;
}

const MarkerPanel: React.FC<MarkerPanelProps> = ({
  title,
  subTitle,
  markers,
  isOpen,
  onToggle,
  onMarkerChange,
  panelIcon
}) => {
  return (
    <div className="border-t first:border-t-0 border-gray-100">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-all group"
      >
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : 'transform rotate-0'}`} />
        <BrainCircuit className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-xs text-gray-500 bg-gray-100 py-0.5 px-2 rounded-md font-medium">{subTitle}</span>
      </button>

      {isOpen && (
        <div className="px-2 pb-2">
          <div className="grid grid-cols-9 gap-1.5 md:grid-cols-11 lg:grid-cols-13">
            {markers.map(({ name, value }) => {
              const colorClass = getMarkerColorClass(name);
              const hasValue = value && value.trim() !== '';

              return (
                <div key={name} className="relative group/marker">
                  <div className={twMerge(
                    "h-7 flex items-center justify-center bg-gradient-to-br border rounded-t-lg",
                    colorClass
                  )}>
                    <span className="text-[10px] font-semibold leading-none">{name}</span>
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onMarkerChange?.(name, e.target.value)}
                    className={twMerge(
                      "w-full h-9 px-1 text-center text-sm border border-t-0 rounded-b-lg focus:outline-none focus:ring-1 transition-all font-medium",
                      hasValue ? "bg-primary/5 border-primary text-primary focus:border-primary focus:ring-primary/40"
                              : "border-gray-200 focus:border-primary focus:ring-primary/40 group-hover/marker:border-gray-300"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const STRMarkerGrid: React.FC<{
  onMarkerChange?: (marker: string, value: string) => void;
  initialMarkers?: Record<string, string>;
}> = ({
  onMarkerChange,
  initialMarkers = {}
}) => {
  const [openPanels, setOpenPanels] = useState({
    panel1: true,
    panel2: true,
    panel3: true,
    panel4a: true,
    panel4b: true,
    panel4c: true,
    panel5a: true,
    panel5b: true,
    panel5c: true,
    panel5d: true
  });

  const panels = [
    {
      id: 'panel1',
      title: 'FTDNA Panel 1',
      subTitle: '(1-12)',
      panelIcon: 'dna',
      markers: ['DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii']
    },
    {
      id: 'panel2',
      title: 'FTDNA Panel 2',
      subTitle: '(13-25)',
      markers: ['DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464']
    },
    {
      id: 'panel3',
      title: 'FTDNA Panel 3',
      subTitle: '(26-37)',
      markers: ['DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438']
    },
    {
      id: 'panel4a',
      title: 'FTDNA Panel 4',
      subTitle: '(38-47)',
      markers: ['DYS531', 'DYS578', 'DYF395', 'DYS590', 'DYS537', 'DYS641', 'DYS472', 'DYF406S1', 'DYS511']
    },
    {
      id: 'panel4b',
      title: 'FTDNA Panel 4',
      subTitle: '(48-60)',
      markers: ['DYS425', 'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490', 'DYS534', 'DYS450', 'DYS444', 'DYS481', 'DYS520', 'DYS446']
    },
    {
      id: 'panel4c',
      title: 'FTDNA Panel 4',
      subTitle: '(61-67)',
      markers: ['DYS617', 'DYS568', 'DYS487', 'DYS572', 'DYS640', 'DYS492', 'DYS565']
    },
    {
      id: 'panel5a',
      title: 'FTDNA Panel 5',
      subTitle: '(68-75)',
      markers: ['DYS710', 'DYS485', 'DYS632', 'DYS495', 'DYS540', 'DYS714', 'DYS716', 'DYS717']
    },
    {
      id: 'panel5b',
      title: 'FTDNA Panel 5',
      subTitle: '(76-85)',
      markers: ['DYS505', 'DYS556', 'DYS549', 'DYS589', 'DYS522', 'DYS494', 'DYS533', 'DYS636', 'DYS575', 'DYS638']
    },
    {
      id: 'panel5c',
      title: 'FTDNA Panel 5',
      subTitle: '(86-93)',
      markers: ['DYS462', 'DYS452', 'DYS445', 'Y-GATA-A10', 'DYS463', 'DYS441', 'Y-GGAAT-1B07', 'DYS525']
    },
    {
      id: 'panel5d',
      title: 'FTDNA Panel 5',
      subTitle: '(94-111)',
      markers: ['DYS712', 'DYS593', 'DYS650', 'DYS532', 'DYS715', 'DYS504', 'DYS513', 'DYS561', 'DYS552', 
                'DYS726', 'DYS635', 'DYS587', 'DYS643', 'DYS497', 'DYS510', 'DYS434', 'DYS461', 'DYS435']
    }
  ];

  const formatMarkers = (markerNames: string[]) => 
    markerNames.map(name => ({
      name,
      value: initialMarkers[name] || ''
    }));

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm p-3">
      <div className="text-sm font-bold text-primary mb-2 pb-2 border-b border-gray-100 flex items-center">
        <BrainCircuit className="h-4 w-4 mr-2" />
        STR Маркеры
      </div>
      {panels.map(panel => (
        <MarkerPanel
          key={panel.id}
          title={panel.title}
          subTitle={panel.subTitle}
          markers={formatMarkers(panel.markers)}
          isOpen={openPanels[panel.id as keyof typeof openPanels]}
          onToggle={() => setOpenPanels(prev => ({
            ...prev,
            [panel.id]: !prev[panel.id as keyof typeof openPanels]
          }))}
          onMarkerChange={onMarkerChange}
          panelIcon={panel.panelIcon}
        />
      ))}
    </div>
  );
};

export default STRMarkerGrid;