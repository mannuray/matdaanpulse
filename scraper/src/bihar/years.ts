import type { Year } from './types';

export interface YearConfig {
  year: Year; electionId: string; constPrefix: string;
  source: { title: string; url: string };
  files: { pdf: string } | { detailed: string; summary: string; parties: string; performance: string };
}

const OLD = (docid: number) => `https://www.eci.gov.in/eci-backend/public/api/old-site-statistical-report-data?docid=${docid}`;

export const YEARS: Record<Year, YearConfig> = {
  2010: { year: 2010, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111010', constPrefix: 'BR_VS10_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2010', url: OLD(3903) },
    files: { pdf: '2010/ECI_Statistical_Report_Bihar_AE_2010.pdf' } },
  2015: { year: 2015, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111015', constPrefix: 'BR_VS15_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2015', url: OLD(3904) },
    files: { pdf: '2015/ECI_Statistical_Report_Bihar_AE_2015.pdf' } },
  2020: { year: 2020, electionId: 'b2c3d4e5-f6a7-8901-bcde-123456789020', constPrefix: 'BR_VS20_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2020', url: OLD(12787) },
    files: { detailed: '2020/10_-_Detailed_Results.xls', summary: '2020/8_-_Constituency_Data_Summary.xlsx',
      parties: '2020/3_-_List_Of_Political_Parties_Participated.xls', performance: '2020/5-Performance_of_Political_Parties.xlsx' } },
  2025: { year: 2025, electionId: 'c3d4e5f6-a7b8-9012-cdef-234567890abc', constPrefix: 'BR_VS_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2025', url: 'https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=16' },
    files: { detailed: '2025/10-Detailed_Results.xlsx', summary: '2025/8-Constituency_Data_Summery_Report.xlsx',
      parties: '2025/3-List_Of_Political_Parties_Participated.xlsx', performance: '2025/5-Performance_of_Political_Parties.xlsx' } },
};
