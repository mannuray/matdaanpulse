/**
 * Generate Bihar Vidhan Sabha 2020 seed SQL from hardcoded scraped data.
 *
 * Usage: npx ts-node src/generate-bihar-vs-2020-seed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const ELECTION_ID = 'b2c3d4e5-f6a7-8901-bcde-123456789020';
const STATE_ID = 5; // Bihar

/** Party abbreviation mapping: StatisticsTimes source → our DB IDs */
const PARTY_MAP: Record<string, string> = {
  'BJP': 'BJP',
  'INC': 'INC',
  'JD(U)': 'JDU',
  'RJD': 'RJD',
  'CPI(ML)(L)': 'CPIML',
  'CPI(M)': 'CPIM',
  'CPI': 'CPI',
  'HAMS': 'HAMS',
  'LJP': 'LJP',
  'AIMIM': 'AIMIM',
  'BSP': 'BSP',
  'VSIP': 'VSIP',
  'IND': 'IND',
  'JTVP': 'JTVP',
};

/** Party colors (reuse from existing seeds) */
const PARTY_COLORS: Record<string, string> = {
  BJP: '#FF6B00',
  INC: '#00BFFF',
  JDU: '#003366',
  RJD: '#2E8B57',
  CPIML: '#CC0000',
  CPIM: '#FF0000',
  CPI: '#FF0000',
  HAMS: '#228B22',
  LJP: '#0000CD',
  AIMIM: '#008000',
  BSP: '#0033CC',
  VSIP: '#808080',
  IND: '#808080',
  JTVP: '#808080',
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** Build constituency ID for 2020: BR_VS20_{constNo}_{NAME} (distinct from 2025's BR_VS_) */
function makeConstId(name: string, constNo: number): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `BR_VS20_${constNo}_${clean}`;
}

interface RawRow {
  constNo: number;
  name: string;
  winnerName: string;
  winnerParty: string;
  runnerUpName: string;
  runnerUpParty: string;
  margin: number;
}

/** All 243 constituencies from Bihar 2020 election (scraped from StatisticsTimes/ECI) */
const RAW_DATA: RawRow[] = [
  { constNo: 1, name: 'Valmikinagar', winnerName: 'Dhirendra Pratap Singh Alias Rinku Singh', winnerParty: 'JD(U)', runnerUpName: 'Rajesh Singh', runnerUpParty: 'INC', margin: 21585 },
  { constNo: 2, name: 'Ramnagar', winnerName: 'Bhagirathi Devi', winnerParty: 'BJP', runnerUpName: 'Rajesh Ram', runnerUpParty: 'INC', margin: 15796 },
  { constNo: 3, name: 'Narkatiaganj', winnerName: 'Rashmi Varma', winnerParty: 'BJP', runnerUpName: 'Vinay Varma', runnerUpParty: 'INC', margin: 21134 },
  { constNo: 4, name: 'Bagaha', winnerName: 'Ram Singh', winnerParty: 'BJP', runnerUpName: 'Jayesh Manglam Singh', runnerUpParty: 'INC', margin: 30020 },
  { constNo: 5, name: 'Lauriya', winnerName: 'Vinay Bihari', winnerParty: 'BJP', runnerUpName: 'Shambhu Tiwari', runnerUpParty: 'RJD', margin: 29004 },
  { constNo: 6, name: 'Nautan', winnerName: 'Narayan Prasad', winnerParty: 'BJP', runnerUpName: 'Sheikh Mohammad Kamran', runnerUpParty: 'INC', margin: 25896 },
  { constNo: 7, name: 'Chanpatia', winnerName: 'Umakant Singh', winnerParty: 'BJP', runnerUpName: 'Abhishek Ranjan', runnerUpParty: 'INC', margin: 13469 },
  { constNo: 8, name: 'Bettiah', winnerName: 'Renu Devi', winnerParty: 'BJP', runnerUpName: 'Madan Mohan Tiwari', runnerUpParty: 'INC', margin: 18079 },
  { constNo: 9, name: 'Sikta', winnerName: 'Birendra Prasad Gupta', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Dilip Varma', runnerUpParty: 'IND', margin: 2302 },
  { constNo: 10, name: 'Raxaul', winnerName: 'Pramod Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Rambabu Prashad Yadav', runnerUpParty: 'INC', margin: 36923 },
  { constNo: 11, name: 'Sugauli', winnerName: 'Er. Shashi Bhushan Singh', winnerParty: 'RJD', runnerUpName: 'Ramchandra Sahni', runnerUpParty: 'VSIP', margin: 3447 },
  { constNo: 12, name: 'Narkatia', winnerName: 'Shamim Ahmad', winnerParty: 'RJD', runnerUpName: 'Shyam Bihari Prasad', runnerUpParty: 'JD(U)', margin: 27791 },
  { constNo: 13, name: 'Harsidhi', winnerName: 'Krishnanandan Paswan', winnerParty: 'BJP', runnerUpName: 'Kumar Nagendra Bihari', runnerUpParty: 'RJD', margin: 15685 },
  { constNo: 14, name: 'Govindganj', winnerName: 'Sunil Mani Tiwari', winnerParty: 'BJP', runnerUpName: 'Brajesh Kumar', runnerUpParty: 'INC', margin: 27780 },
  { constNo: 15, name: 'Kesaria', winnerName: 'Shalini Mishra', winnerParty: 'JD(U)', runnerUpName: 'Santosh Kushwha', runnerUpParty: 'RJD', margin: 9227 },
  { constNo: 16, name: 'Kalyanpur', winnerName: 'Manoj Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Sachindra Prasad Singh', runnerUpParty: 'BJP', margin: 1193 },
  { constNo: 17, name: 'Pipra', winnerName: 'Shyambabu Prasad Yadav', winnerParty: 'BJP', runnerUpName: 'Rajmangal Prasad', runnerUpParty: 'CPI(M)', margin: 8177 },
  { constNo: 18, name: 'Madhuban', winnerName: 'Rana Randhir', winnerParty: 'BJP', runnerUpName: 'Madan Prasad', runnerUpParty: 'RJD', margin: 5878 },
  { constNo: 19, name: 'Motihari', winnerName: 'Pramod Kumar', winnerParty: 'BJP', runnerUpName: 'Om Prakash Chaudhary', runnerUpParty: 'RJD', margin: 14645 },
  { constNo: 20, name: 'Chiraiya', winnerName: 'Lal Babu Prasad Gupta', winnerParty: 'BJP', runnerUpName: 'Achchhelal Prasad', runnerUpParty: 'RJD', margin: 16874 },
  { constNo: 21, name: 'Dhaka', winnerName: 'Pawan Kumar Jaiswal', winnerParty: 'BJP', runnerUpName: 'Faisal Rahman', runnerUpParty: 'RJD', margin: 10114 },
  { constNo: 22, name: 'Sheohar', winnerName: 'Chetan Anand', winnerParty: 'RJD', runnerUpName: 'Md. Sharfuddin', runnerUpParty: 'JD(U)', margin: 36686 },
  { constNo: 23, name: 'Riga', winnerName: 'Moti Lal Prasad', winnerParty: 'BJP', runnerUpName: 'Amit Kumar', runnerUpParty: 'INC', margin: 32495 },
  { constNo: 24, name: 'Bathnaha', winnerName: 'Anil Kumar', winnerParty: 'BJP', runnerUpName: 'Sanjay Ram', runnerUpParty: 'INC', margin: 46818 },
  { constNo: 25, name: 'Parihar', winnerName: 'Gaytri Devi', winnerParty: 'BJP', runnerUpName: 'Ritu Kumar', runnerUpParty: 'RJD', margin: 1569 },
  { constNo: 26, name: 'Sursand', winnerName: 'Dilip Ray', winnerParty: 'JD(U)', runnerUpName: 'Sayed Abu Dojana', runnerUpParty: 'RJD', margin: 8876 },
  { constNo: 27, name: 'Bajpatti', winnerName: 'Mukesh Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Dr. Ranju Geeta', runnerUpParty: 'JD(U)', margin: 2704 },
  { constNo: 28, name: 'Sitamarhi', winnerName: 'Mithilesh Kumar', winnerParty: 'BJP', runnerUpName: 'Sunil Kumar', runnerUpParty: 'RJD', margin: 11475 },
  { constNo: 29, name: 'Runnisaidpur', winnerName: 'Pankaj Kumar Mishra', winnerParty: 'JD(U)', runnerUpName: 'Mangita Devi', runnerUpParty: 'RJD', margin: 24629 },
  { constNo: 30, name: 'Belsand', winnerName: 'Sanjay Kumar Gupta', winnerParty: 'RJD', runnerUpName: 'Sunita Singh Chauhan', runnerUpParty: 'JD(U)', margin: 13931 },
  { constNo: 31, name: 'Harlakhi', winnerName: 'Sudhanshu Shekhar', winnerParty: 'JD(U)', runnerUpName: 'Ram Naresh Pandey', runnerUpParty: 'CPI', margin: 17593 },
  { constNo: 32, name: 'Benipatti', winnerName: 'Vinod Narayan Jha', winnerParty: 'BJP', runnerUpName: 'Bhawana Jha', runnerUpParty: 'INC', margin: 32652 },
  { constNo: 33, name: 'Khajauli', winnerName: 'Arun Shankar Prasad', winnerParty: 'BJP', runnerUpName: 'Sitaram Yadav', runnerUpParty: 'RJD', margin: 22689 },
  { constNo: 34, name: 'Babubarhi', winnerName: 'Mina Kumari', winnerParty: 'JD(U)', runnerUpName: 'Umakant Yadav', runnerUpParty: 'RJD', margin: 11488 },
  { constNo: 35, name: 'Bisfi', winnerName: 'Haribhushan Thakur', winnerParty: 'BJP', runnerUpName: 'Da. Faiyaz Ahmad', runnerUpParty: 'RJD', margin: 10282 },
  { constNo: 36, name: 'Madhubani', winnerName: 'Samir Kumar Mahaseth', winnerParty: 'RJD', runnerUpName: 'Suman Kumar Mahaseth', runnerUpParty: 'VSIP', margin: 6814 },
  { constNo: 37, name: 'Rajnagar', winnerName: 'Dr. Ramprit Paswan', winnerParty: 'BJP', runnerUpName: 'Ramawatar Paswan', runnerUpParty: 'RJD', margin: 19121 },
  { constNo: 38, name: 'Jhanjharpur', winnerName: 'Nitish Mishra', winnerParty: 'BJP', runnerUpName: 'Ram Narayan Yadav', runnerUpParty: 'CPI', margin: 41788 },
  { constNo: 39, name: 'Phulparas', winnerName: 'Sheela Kumari', winnerParty: 'JD(U)', runnerUpName: 'Kripanath Pathak', runnerUpParty: 'INC', margin: 10966 },
  { constNo: 40, name: 'Laukaha', winnerName: 'Bharat Bhushan Mandal', winnerParty: 'RJD', runnerUpName: 'Lakshmeshwar Ray', runnerUpParty: 'JD(U)', margin: 10077 },
  { constNo: 41, name: 'Nirmali', winnerName: 'Aniruddha Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Yadubansh Kumar Yadav', runnerUpParty: 'RJD', margin: 43922 },
  { constNo: 42, name: 'Pipra', winnerName: 'Rambilash Kamat', winnerParty: 'JD(U)', runnerUpName: 'Vishwa Mohan Kumar', runnerUpParty: 'RJD', margin: 19245 },
  { constNo: 43, name: 'Supaul', winnerName: 'Bijendra Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Minnatullah Rahmani', runnerUpParty: 'INC', margin: 28099 },
  { constNo: 44, name: 'Triveniganj', winnerName: 'Veena Bharti', winnerParty: 'JD(U)', runnerUpName: 'Santosh Kumar', runnerUpParty: 'RJD', margin: 3031 },
  { constNo: 45, name: 'Chhatapur', winnerName: 'Neeraj Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Vipin Kumar Singh', runnerUpParty: 'RJD', margin: 20635 },
  { constNo: 46, name: 'Narpatganj', winnerName: 'Jai Prakash Yadav', winnerParty: 'BJP', runnerUpName: 'Anil Kumar Yadav', runnerUpParty: 'RJD', margin: 28610 },
  { constNo: 47, name: 'Raniganj', winnerName: 'Achmit Rishidev', winnerParty: 'JD(U)', runnerUpName: 'Avinash Manglam', runnerUpParty: 'RJD', margin: 2304 },
  { constNo: 48, name: 'Forbesganj', winnerName: 'Vidya Sagar Keshari', winnerParty: 'BJP', runnerUpName: 'Zakir Hussain Khan', runnerUpParty: 'INC', margin: 19702 },
  { constNo: 49, name: 'Araria', winnerName: 'Abidur Rahman', winnerParty: 'INC', runnerUpName: 'Shagufta Azim', runnerUpParty: 'JD(U)', margin: 47936 },
  { constNo: 50, name: 'Jokihat', winnerName: 'Shahnawaz', winnerParty: 'AIMIM', runnerUpName: 'Sarfaraz Alam', runnerUpParty: 'RJD', margin: 7383 },
  { constNo: 51, name: 'Sikti', winnerName: 'Vijay Kumar Mandal', winnerParty: 'BJP', runnerUpName: 'Shatrughan Prasad Suman', runnerUpParty: 'RJD', margin: 13610 },
  { constNo: 52, name: 'Bahadurganj', winnerName: 'Mohammad Anzar Nayeemi', winnerParty: 'AIMIM', runnerUpName: 'Lakhan Lal Pandit', runnerUpParty: 'VSIP', margin: 45215 },
  { constNo: 53, name: 'Thakurganj', winnerName: 'Saud Alam', winnerParty: 'RJD', runnerUpName: 'Gopal Kumar Agarwal', runnerUpParty: 'IND', margin: 23887 },
  { constNo: 54, name: 'Kishanganj', winnerName: 'Ijaharul Husain', winnerParty: 'INC', runnerUpName: 'Sweety Singh', runnerUpParty: 'BJP', margin: 1381 },
  { constNo: 55, name: 'Kochadhaman', winnerName: 'Muhammed Izhar Asfi', winnerParty: 'AIMIM', runnerUpName: 'Mujahid Alam', runnerUpParty: 'JD(U)', margin: 36143 },
  { constNo: 56, name: 'Amour', winnerName: 'Akhtarul Iman', winnerParty: 'AIMIM', runnerUpName: 'Saba Zafar', runnerUpParty: 'JD(U)', margin: 52515 },
  { constNo: 57, name: 'Baisi', winnerName: 'Syed Ruknuddin Ahmad', winnerParty: 'AIMIM', runnerUpName: 'Vinod Kumar', runnerUpParty: 'BJP', margin: 16373 },
  { constNo: 58, name: 'Kasba', winnerName: 'Md. Afaque Alam', winnerParty: 'INC', runnerUpName: 'Pradeep Kumar Das', runnerUpParty: 'LJP', margin: 17278 },
  { constNo: 59, name: 'Banmankhi', winnerName: 'Krishna Kumar Rishi', winnerParty: 'BJP', runnerUpName: 'Upendra Sharma', runnerUpParty: 'RJD', margin: 27743 },
  { constNo: 60, name: 'Rupauli', winnerName: 'Bima Bharti', winnerParty: 'JD(U)', runnerUpName: 'Shankar Singh', runnerUpParty: 'LJP', margin: 19330 },
  { constNo: 61, name: 'Dhamdaha', winnerName: 'Leshi Singh', winnerParty: 'JD(U)', runnerUpName: 'Dilip Kumar Yadav', runnerUpParty: 'RJD', margin: 33594 },
  { constNo: 62, name: 'Purnia', winnerName: 'Vijay Kumar Khemka', winnerParty: 'BJP', runnerUpName: 'Indu Sinha', runnerUpParty: 'INC', margin: 32154 },
  { constNo: 63, name: 'Katihar', winnerName: 'Tarkishore Prasad', winnerParty: 'BJP', runnerUpName: 'Dr. Ram Prakash Mahto', runnerUpParty: 'RJD', margin: 10519 },
  { constNo: 64, name: 'Kadwa', winnerName: 'Shakeel Ahmad Khan', winnerParty: 'INC', runnerUpName: 'Chandra Bhushan Thakur', runnerUpParty: 'LJP', margin: 32402 },
  { constNo: 65, name: 'Balrampur', winnerName: 'Mahboob Alam', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Barun Kumar Jha', runnerUpParty: 'VSIP', margin: 53597 },
  { constNo: 66, name: 'Pranpur', winnerName: 'Nisha Singh', winnerParty: 'BJP', runnerUpName: 'Tauquir Alam', runnerUpParty: 'INC', margin: 2972 },
  { constNo: 67, name: 'Manihari', winnerName: 'Manohar Prasad Singh', winnerParty: 'INC', runnerUpName: 'Shambhu Kumar Suman', runnerUpParty: 'JD(U)', margin: 21209 },
  { constNo: 68, name: 'Barari', winnerName: 'Bijay Singh', winnerParty: 'JD(U)', runnerUpName: 'Neeraj Kumar', runnerUpParty: 'RJD', margin: 10438 },
  { constNo: 69, name: 'Korha', winnerName: 'Kavita Devi', winnerParty: 'BJP', runnerUpName: 'Punam Kumari Alias Punam Paswan', runnerUpParty: 'INC', margin: 28943 },
  { constNo: 70, name: 'Alamnagar', winnerName: 'Narendra Narayan Yadav', winnerParty: 'JD(U)', runnerUpName: 'Nabin Kumar', runnerUpParty: 'RJD', margin: 28680 },
  { constNo: 71, name: 'Bihariganj', winnerName: 'Niranjan Kumar Mehta', winnerParty: 'JD(U)', runnerUpName: 'Subhashini Bundela', runnerUpParty: 'INC', margin: 18711 },
  { constNo: 72, name: 'Singheshwar', winnerName: 'Chandrahas Chaupal', winnerParty: 'RJD', runnerUpName: 'Ramesh Rishidev', runnerUpParty: 'JD(U)', margin: 5573 },
  { constNo: 73, name: 'Madhepura', winnerName: 'Chandra Shekhar', winnerParty: 'RJD', runnerUpName: 'Nikhil Mandal', runnerUpParty: 'JD(U)', margin: 16046 },
  { constNo: 74, name: 'Sonbarsha', winnerName: 'Ratnesh Sada', winnerParty: 'JD(U)', runnerUpName: 'Tarni Rishideo', runnerUpParty: 'INC', margin: 13466 },
  { constNo: 75, name: 'Saharsa', winnerName: 'Alok Ranjan', winnerParty: 'BJP', runnerUpName: 'Lovely Anand', runnerUpParty: 'RJD', margin: 19679 },
  { constNo: 76, name: 'Simri Bakhtiarpur', winnerName: 'Yusuf Salahuddin', winnerParty: 'RJD', runnerUpName: 'Mukesh Sahani', runnerUpParty: 'VSIP', margin: 1759 },
  { constNo: 77, name: 'Mahishi', winnerName: 'Gunjeshwar Sah', winnerParty: 'JD(U)', runnerUpName: 'Gautam Krishna', runnerUpParty: 'RJD', margin: 1630 },
  { constNo: 78, name: 'Kusheshwar Asthan', winnerName: 'Shashibhushan Hajari', winnerParty: 'JD(U)', runnerUpName: 'Dr. Ashok Kumar', runnerUpParty: 'INC', margin: 7222 },
  { constNo: 79, name: 'Gaura Bauram', winnerName: 'Swarna Singh', winnerParty: 'VSIP', runnerUpName: 'Afzal Ali Khan', runnerUpParty: 'RJD', margin: 7280 },
  { constNo: 80, name: 'Benipur', winnerName: 'Binay Kumar Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Mithilesh Kumar Choudhary', runnerUpParty: 'INC', margin: 6590 },
  { constNo: 81, name: 'Alinagar', winnerName: 'Mishri Lal Yadav', winnerParty: 'VSIP', runnerUpName: 'Binod Mishra', runnerUpParty: 'RJD', margin: 3101 },
  { constNo: 82, name: 'Darbhanga Rural', winnerName: 'Lalit Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Faraz Fatmi', runnerUpParty: 'JD(U)', margin: 2141 },
  { constNo: 83, name: 'Darbhanga', winnerName: 'Sanjay Saraogi', winnerParty: 'BJP', runnerUpName: 'Amar Nath Gami', runnerUpParty: 'RJD', margin: 10639 },
  { constNo: 84, name: 'Hayaghat', winnerName: 'Ram Chandra Prasad', winnerParty: 'BJP', runnerUpName: 'Bhola Yadav', runnerUpParty: 'RJD', margin: 10252 },
  { constNo: 85, name: 'Bahadurpur', winnerName: 'Madan Sahni', winnerParty: 'JD(U)', runnerUpName: 'Ramesh Choudhary', runnerUpParty: 'RJD', margin: 2629 },
  { constNo: 86, name: 'Keoti', winnerName: 'Murari Mohan Jha', winnerParty: 'BJP', runnerUpName: 'Abdul Bari Siddiqui', runnerUpParty: 'RJD', margin: 5126 },
  { constNo: 87, name: 'Jale', winnerName: 'Jibesh Kumar', winnerParty: 'BJP', runnerUpName: 'Maskoor Ahmad Usmani', runnerUpParty: 'INC', margin: 21796 },
  { constNo: 88, name: 'Gaighat', winnerName: 'Niranjan Roy', winnerParty: 'RJD', runnerUpName: 'Maheshwar Pd Yadav', runnerUpParty: 'JD(U)', margin: 7566 },
  { constNo: 89, name: 'Aurai', winnerName: 'Ram Surat Kumar', winnerParty: 'BJP', runnerUpName: 'Md. Aftab Alam', runnerUpParty: 'CPI(ML)(L)', margin: 47866 },
  { constNo: 90, name: 'Minapur', winnerName: 'Rajeev Kumar', winnerParty: 'RJD', runnerUpName: 'Manoj Kumar', runnerUpParty: 'JD(U)', margin: 15512 },
  { constNo: 91, name: 'Bochaha', winnerName: 'Musafir Paswan', winnerParty: 'VSIP', runnerUpName: 'Ramai Ram', runnerUpParty: 'RJD', margin: 11268 },
  { constNo: 92, name: 'Sakra', winnerName: 'Ashok Kumar Chodhary', winnerParty: 'JD(U)', runnerUpName: 'Umesh Kumar Ram', runnerUpParty: 'INC', margin: 1537 },
  { constNo: 93, name: 'Kurhani', winnerName: 'Anil Kumar Sahni', winnerParty: 'RJD', runnerUpName: 'Kedar Prasad Gupta', runnerUpParty: 'BJP', margin: 712 },
  { constNo: 94, name: 'Muzaffarpur', winnerName: 'Bijendra Chaudhary', winnerParty: 'INC', runnerUpName: 'Suresh Kumar Sharma', runnerUpParty: 'BJP', margin: 6326 },
  { constNo: 95, name: 'Kanti', winnerName: 'Mohammad Israil Mansuri', winnerParty: 'RJD', runnerUpName: 'Ajit Kumar', runnerUpParty: 'IND', margin: 10314 },
  { constNo: 96, name: 'Baruraj', winnerName: 'Arun Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Nand Kumar Rai', runnerUpParty: 'RJD', margin: 43654 },
  { constNo: 97, name: 'Paroo', winnerName: 'Ashok Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Shankar Prasad', runnerUpParty: 'IND', margin: 14698 },
  { constNo: 98, name: 'Sahebganj', winnerName: 'Raju Kumar Singh', winnerParty: 'VSIP', runnerUpName: 'Ramvichar Rai', runnerUpParty: 'RJD', margin: 15333 },
  { constNo: 99, name: 'Baikunthpur', winnerName: 'Prem Shankar Prasad', winnerParty: 'RJD', runnerUpName: 'Mithilesh Tiwari', runnerUpParty: 'BJP', margin: 11113 },
  { constNo: 100, name: 'Barauli', winnerName: 'Rampravesh Rai', winnerParty: 'BJP', runnerUpName: 'Reyazul Haque Urf Raju', runnerUpParty: 'RJD', margin: 14155 },
  { constNo: 101, name: 'Gopalganj', winnerName: 'Subash Singh', winnerParty: 'BJP', runnerUpName: 'Anirudh Prasad Alias Sadhu Yadav', runnerUpParty: 'BSP', margin: 36752 },
  { constNo: 102, name: 'Kuchaikote', winnerName: 'Amrendra Kumar Pandey', winnerParty: 'JD(U)', runnerUpName: 'Kali Prasad Pandey', runnerUpParty: 'INC', margin: 20630 },
  { constNo: 103, name: 'Bhorey', winnerName: 'Sunil Kumar', winnerParty: 'JD(U)', runnerUpName: 'Jitendra Paswan', runnerUpParty: 'CPI(ML)(L)', margin: 462 },
  { constNo: 104, name: 'Hathua', winnerName: 'Rajesh Kumar Singh', winnerParty: 'RJD', runnerUpName: 'Ramsewak Singh', runnerUpParty: 'JD(U)', margin: 30527 },
  { constNo: 105, name: 'Siwan', winnerName: 'Awadh Bihari Chaudhary', winnerParty: 'RJD', runnerUpName: 'Om Prakash Yadav', runnerUpParty: 'BJP', margin: 1973 },
  { constNo: 106, name: 'Ziradei', winnerName: 'Amarjeet Kushwaha', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Kamala Singh', runnerUpParty: 'JD(U)', margin: 25510 },
  { constNo: 107, name: 'Darauli', winnerName: 'Satyadeo Ram', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Ramayan Manjhi', runnerUpParty: 'BJP', margin: 12119 },
  { constNo: 108, name: 'Raghunathpur', winnerName: 'Harishankar Yadav', winnerParty: 'RJD', runnerUpName: 'Manoj Kumar Singh', runnerUpParty: 'LJP', margin: 17965 },
  { constNo: 109, name: 'Daraundha', winnerName: 'Karnjeet Singh Alias Vyas Singh', winnerParty: 'BJP', runnerUpName: 'Amarnath Yadav', runnerUpParty: 'CPI(ML)(L)', margin: 11320 },
  { constNo: 110, name: 'Barharia', winnerName: 'Bachcha Pandey', winnerParty: 'RJD', runnerUpName: 'Shyambahadur Singh', runnerUpParty: 'JD(U)', margin: 3559 },
  { constNo: 111, name: 'Goriakothi', winnerName: 'Devesh Kant Singh', winnerParty: 'BJP', runnerUpName: 'Nutan Devi', runnerUpParty: 'RJD', margin: 11891 },
  { constNo: 112, name: 'Maharajganj', winnerName: 'Vijay Shanker Dubey', winnerParty: 'INC', runnerUpName: 'Hem Narayan Sah', runnerUpParty: 'JD(U)', margin: 1976 },
  { constNo: 113, name: 'Ekma', winnerName: 'Srikant Yadav', winnerParty: 'RJD', runnerUpName: 'Sita Devi', runnerUpParty: 'JD(U)', margin: 13927 },
  { constNo: 114, name: 'Manjhi', winnerName: 'Dr. Satyendra Yadav', winnerParty: 'CPI(M)', runnerUpName: 'Rana Pratap Singh', runnerUpParty: 'IND', margin: 25386 },
  { constNo: 115, name: 'Baniapur', winnerName: 'Kedar Nath Singh', winnerParty: 'RJD', runnerUpName: 'Virendra Kumar Ojha', runnerUpParty: 'VSIP', margin: 27789 },
  { constNo: 116, name: 'Taraiya', winnerName: 'Janak Singh', winnerParty: 'BJP', runnerUpName: 'Sipahi Lal Mahto', runnerUpParty: 'RJD', margin: 11307 },
  { constNo: 117, name: 'Marhaura', winnerName: 'Jitendra Kumar Ray', winnerParty: 'RJD', runnerUpName: 'Altaf Alam', runnerUpParty: 'JD(U)', margin: 11385 },
  { constNo: 118, name: 'Chapra', winnerName: 'Dr. C. N. Gupta', winnerParty: 'BJP', runnerUpName: 'Randhir Kumar Singh', runnerUpParty: 'RJD', margin: 6771 },
  { constNo: 119, name: 'Garkha', winnerName: 'Surendra Ram', winnerParty: 'RJD', runnerUpName: 'Gyanchand Manjhi', runnerUpParty: 'BJP', margin: 9937 },
  { constNo: 120, name: 'Amnour', winnerName: 'Krishan Kumar Mantoo', winnerParty: 'BJP', runnerUpName: 'Sunil Kumar', runnerUpParty: 'RJD', margin: 3681 },
  { constNo: 121, name: 'Parsa', winnerName: 'Chhote Lal Ray', winnerParty: 'RJD', runnerUpName: 'Chandrika Roy', runnerUpParty: 'JD(U)', margin: 17293 },
  { constNo: 122, name: 'Sonepur', winnerName: 'Dr. Ramanuj Prasad', winnerParty: 'RJD', runnerUpName: 'Vinay Kumar Singh', runnerUpParty: 'BJP', margin: 6686 },
  { constNo: 123, name: 'Hajipur', winnerName: 'Awadhesh Singh', winnerParty: 'BJP', runnerUpName: 'Deo Kumar Chaurasia', runnerUpParty: 'RJD', margin: 2990 },
  { constNo: 124, name: 'Lalganj', winnerName: 'Sanjay Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Rakesh Kumar', runnerUpParty: 'INC', margin: 26299 },
  { constNo: 125, name: 'Vaishali', winnerName: 'Siddharth Patel', winnerParty: 'JD(U)', runnerUpName: 'Sanjeev Singh', runnerUpParty: 'INC', margin: 7413 },
  { constNo: 126, name: 'Mahua', winnerName: 'Mukesh Kumar Raushan', winnerParty: 'RJD', runnerUpName: 'Ashma Parveen', runnerUpParty: 'JD(U)', margin: 13770 },
  { constNo: 127, name: 'Rajapakar', winnerName: 'Pratima Kumari', winnerParty: 'INC', runnerUpName: 'Mahendra Ram', runnerUpParty: 'JD(U)', margin: 1796 },
  { constNo: 128, name: 'Raghopur', winnerName: 'Tejashwi Prasad Yadav', winnerParty: 'RJD', runnerUpName: 'Satish Kumar', runnerUpParty: 'BJP', margin: 38174 },
  { constNo: 129, name: 'Mahnar', winnerName: 'Bina Singh', winnerParty: 'RJD', runnerUpName: 'Umesh Singh Kushwaha', runnerUpParty: 'JD(U)', margin: 7947 },
  { constNo: 130, name: 'Patepur', winnerName: 'Lakhendra Kumar Raushan', winnerParty: 'BJP', runnerUpName: 'Shiv Chandra Ram', runnerUpParty: 'RJD', margin: 25839 },
  { constNo: 131, name: 'Kalyanpur', winnerName: 'Maheshwar Hazari', winnerParty: 'JD(U)', runnerUpName: 'Ranjeet Kumar Ram', runnerUpParty: 'CPI(ML)(L)', margin: 10251 },
  { constNo: 132, name: 'Warisnagar', winnerName: 'Ashok Kumar', winnerParty: 'JD(U)', runnerUpName: 'Phoolbabu Singh', runnerUpParty: 'CPI(ML)(L)', margin: 13801 },
  { constNo: 133, name: 'Samastipur', winnerName: 'Akhtarul Islam Shahin', winnerParty: 'RJD', runnerUpName: 'Ashwamedh Devi', runnerUpParty: 'JD(U)', margin: 4714 },
  { constNo: 134, name: 'Ujiarpur', winnerName: 'Alok Kumar Mehta', winnerParty: 'RJD', runnerUpName: 'Sheel Kumar Roy', runnerUpParty: 'BJP', margin: 23268 },
  { constNo: 135, name: 'Morwa', winnerName: 'Ranvijay Sahu', winnerParty: 'RJD', runnerUpName: 'Vidya Sagar Singh Nishad', runnerUpParty: 'JD(U)', margin: 10671 },
  { constNo: 136, name: 'Sarairanjan', winnerName: 'Vijay Kumar Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Arbind Kumar Sahni', runnerUpParty: 'RJD', margin: 3624 },
  { constNo: 137, name: 'Mohiuddinnagar', winnerName: 'Rajesh Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Ejya Yadav', runnerUpParty: 'RJD', margin: 15114 },
  { constNo: 138, name: 'Bibhutipur', winnerName: 'Ajay Kumar', winnerParty: 'CPI(M)', runnerUpName: 'Ram Balak Singh', runnerUpParty: 'JD(U)', margin: 40496 },
  { constNo: 139, name: 'Rosera', winnerName: 'Birendra Kumar', winnerParty: 'BJP', runnerUpName: 'Nagendra Kumar Vikal', runnerUpParty: 'INC', margin: 35744 },
  { constNo: 140, name: 'Hasanpur', winnerName: 'Tej Pratap Yadav', winnerParty: 'RJD', runnerUpName: 'Raj Kumar Ray', runnerUpParty: 'JD(U)', margin: 21139 },
  { constNo: 141, name: 'Cheria Bariarpur', winnerName: 'Raj Vanshi Mahto', winnerParty: 'RJD', runnerUpName: 'Kumari Manju Varma', runnerUpParty: 'JD(U)', margin: 40897 },
  { constNo: 142, name: 'Bachhwara', winnerName: 'Surendra Mehata', winnerParty: 'BJP', runnerUpName: 'Abdhesh Kumar Rai', runnerUpParty: 'CPI', margin: 484 },
  { constNo: 143, name: 'Teghra', winnerName: 'Ram Ratan Singh', winnerParty: 'CPI', runnerUpName: 'Birendra Kumar', runnerUpParty: 'JD(U)', margin: 47979 },
  { constNo: 144, name: 'Matihani', winnerName: 'Raj Kumar Singh', winnerParty: 'LJP', runnerUpName: 'Narendra Kumar Singh', runnerUpParty: 'JD(U)', margin: 333 },
  { constNo: 145, name: 'Sahebpur Kamal', winnerName: 'Satanand Sambuddha', winnerParty: 'RJD', runnerUpName: 'Shashikant Kumar Shashi', runnerUpParty: 'JD(U)', margin: 14225 },
  { constNo: 146, name: 'Begusarai', winnerName: 'Kundan Kumar', winnerParty: 'BJP', runnerUpName: 'Amita Bhushan', runnerUpParty: 'INC', margin: 4554 },
  { constNo: 147, name: 'Bakhri', winnerName: 'Suryakant Paswan', winnerParty: 'CPI', runnerUpName: 'Ramshankar Paswan', runnerUpParty: 'BJP', margin: 777 },
  { constNo: 148, name: 'Alauli', winnerName: 'Ramvriksh Sada', winnerParty: 'RJD', runnerUpName: 'Sadhna Devi', runnerUpParty: 'JD(U)', margin: 2773 },
  { constNo: 149, name: 'Khagaria', winnerName: 'Chhatrapati Yadav', winnerParty: 'INC', runnerUpName: 'Poonam Devi Yadav', runnerUpParty: 'JD(U)', margin: 3000 },
  { constNo: 150, name: 'Beldaur', winnerName: 'Panna Lal Singh Patel', winnerParty: 'JD(U)', runnerUpName: 'Chandan Kumar', runnerUpParty: 'INC', margin: 5108 },
  { constNo: 151, name: 'Parbatta', winnerName: 'Doctor Sanjeev Kumar', winnerParty: 'JD(U)', runnerUpName: 'Digambar Prasad Tiwary', runnerUpParty: 'RJD', margin: 951 },
  { constNo: 152, name: 'Bihpur', winnerName: 'Kumar Shailendra', winnerParty: 'BJP', runnerUpName: 'Shailesh Kumar', runnerUpParty: 'RJD', margin: 6129 },
  { constNo: 153, name: 'Gopalpur', winnerName: 'Narendra Kumar Niraj', winnerParty: 'JD(U)', runnerUpName: 'Shailesh Kumar', runnerUpParty: 'RJD', margin: 24461 },
  { constNo: 154, name: 'Pirpainti', winnerName: 'Lalan Kumar', winnerParty: 'BJP', runnerUpName: 'Ram Vilash Paswan', runnerUpParty: 'RJD', margin: 27019 },
  { constNo: 155, name: 'Kahalgaon', winnerName: 'Pawan Kumar Yadav', winnerParty: 'BJP', runnerUpName: 'Shubhanand Mukesh', runnerUpParty: 'INC', margin: 42893 },
  { constNo: 156, name: 'Bhagalpur', winnerName: 'Ajit Sharma', winnerParty: 'INC', runnerUpName: 'Rohit Pandey', runnerUpParty: 'BJP', margin: 1113 },
  { constNo: 157, name: 'Sultanganj', winnerName: 'Lalit Narayan Mandal', winnerParty: 'JD(U)', runnerUpName: 'Lalan Kumar', runnerUpParty: 'INC', margin: 11565 },
  { constNo: 158, name: 'Nathnagar', winnerName: 'Ali Ashraf Siddiqui', winnerParty: 'RJD', runnerUpName: 'Lakshmi Kant Mandal', runnerUpParty: 'JD(U)', margin: 7756 },
  { constNo: 159, name: 'Amarpur', winnerName: 'Jayant Raj', winnerParty: 'JD(U)', runnerUpName: 'Jitendra Singh', runnerUpParty: 'INC', margin: 3114 },
  { constNo: 160, name: 'Dhauraiya', winnerName: 'Bhudeo Choudhary', winnerParty: 'RJD', runnerUpName: 'Manish Kumar', runnerUpParty: 'JD(U)', margin: 3060 },
  { constNo: 161, name: 'Banka', winnerName: 'Ram Narayan Mandal', winnerParty: 'BJP', runnerUpName: 'Javed Iqbal Ansari', runnerUpParty: 'RJD', margin: 16828 },
  { constNo: 162, name: 'Katoria', winnerName: 'Dr. Nikki Hembrom', winnerParty: 'BJP', runnerUpName: 'Sweety Sima Hembram', runnerUpParty: 'RJD', margin: 6421 },
  { constNo: 163, name: 'Belhar', winnerName: 'Manoj Yadav', winnerParty: 'JD(U)', runnerUpName: 'Ramdeo Yadav', runnerUpParty: 'RJD', margin: 2473 },
  { constNo: 164, name: 'Tarapur', winnerName: 'Mewa Lal Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Divya Prakash', runnerUpParty: 'RJD', margin: 7225 },
  { constNo: 165, name: 'Munger', winnerName: 'Pranav Kumar', winnerParty: 'BJP', runnerUpName: 'Avinash Kumar Vidyarthi', runnerUpParty: 'RJD', margin: 1244 },
  { constNo: 166, name: 'Jamalpur', winnerName: 'Ajay Kumar Singh', winnerParty: 'INC', runnerUpName: 'Shailesh Kumar', runnerUpParty: 'JD(U)', margin: 4432 },
  { constNo: 167, name: 'Surajgarha', winnerName: 'Prahlad Yadav', winnerParty: 'RJD', runnerUpName: 'Ramanand Mandal', runnerUpParty: 'JD(U)', margin: 9589 },
  { constNo: 168, name: 'Lakhisarai', winnerName: 'Vijay Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Amaresh Kumar', runnerUpParty: 'INC', margin: 10483 },
  { constNo: 169, name: 'Sheikhpura', winnerName: 'Vijay Kumar', winnerParty: 'RJD', runnerUpName: 'Randhir Kumar Soni', runnerUpParty: 'JD(U)', margin: 6116 },
  { constNo: 170, name: 'Barbigha', winnerName: 'Sudarshan Kumar', winnerParty: 'JD(U)', runnerUpName: 'Gajanand Shahi', runnerUpParty: 'INC', margin: 113 },
  { constNo: 171, name: 'Asthawan', winnerName: 'Jitendra Kumar', winnerParty: 'JD(U)', runnerUpName: 'Anil Kumar', runnerUpParty: 'RJD', margin: 11600 },
  { constNo: 172, name: 'Biharsharif', winnerName: 'Dr. Sunil Kumar', winnerParty: 'BJP', runnerUpName: 'Sunil Kumar', runnerUpParty: 'RJD', margin: 15102 },
  { constNo: 173, name: 'Rajgir', winnerName: 'Kaushal Kishore', winnerParty: 'JD(U)', runnerUpName: 'Ravi Joyti Kumar', runnerUpParty: 'INC', margin: 16048 },
  { constNo: 174, name: 'Islampur', winnerName: 'Rakesh Kumar Roushan', winnerParty: 'RJD', runnerUpName: 'Chandra Sen Prasad', runnerUpParty: 'JD(U)', margin: 3698 },
  { constNo: 175, name: 'Hilsa', winnerName: 'Krishnamurari Sharan', winnerParty: 'JD(U)', runnerUpName: 'Atri Muni', runnerUpParty: 'RJD', margin: 12 },
  { constNo: 176, name: 'Nalanda', winnerName: 'Shrawon Kumar', winnerParty: 'JD(U)', runnerUpName: 'Kaushlendra Kumar', runnerUpParty: 'JTVP', margin: 16077 },
  { constNo: 177, name: 'Harnaut', winnerName: 'Hari Narayan Singh', winnerParty: 'JD(U)', runnerUpName: 'Mamta Devi', runnerUpParty: 'LJP', margin: 27241 },
  { constNo: 178, name: 'Mokama', winnerName: 'Anant Kumar Singh', winnerParty: 'RJD', runnerUpName: 'Rajeev Lochan Narayan Singh', runnerUpParty: 'JD(U)', margin: 35757 },
  { constNo: 179, name: 'Barh', winnerName: 'Gyanendra Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Satyendra Bahadur', runnerUpParty: 'INC', margin: 10240 },
  { constNo: 180, name: 'Bakhtiarpur', winnerName: 'Aniruddh Kumar', winnerParty: 'RJD', runnerUpName: 'Ranvijay Singh', runnerUpParty: 'BJP', margin: 20672 },
  { constNo: 181, name: 'Digha', winnerName: 'Sanjiv Chaurasia', winnerParty: 'BJP', runnerUpName: 'Shashi Yadav', runnerUpParty: 'CPI(ML)(L)', margin: 46234 },
  { constNo: 182, name: 'Bankipur', winnerName: 'Nitin Nabin', winnerParty: 'BJP', runnerUpName: 'Luv Sinha', runnerUpParty: 'INC', margin: 39036 },
  { constNo: 183, name: 'Kumhrar', winnerName: 'Arun Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Dharamendra Kumar', runnerUpParty: 'RJD', margin: 26463 },
  { constNo: 184, name: 'Patna Sahib', winnerName: 'Nand Kishore Yadav', winnerParty: 'BJP', runnerUpName: 'Pravin Singh', runnerUpParty: 'INC', margin: 18300 },
  { constNo: 185, name: 'Fatuha', winnerName: 'Dr. Ramanand Yadav', winnerParty: 'RJD', runnerUpName: 'Satyendra Kumar Singh', runnerUpParty: 'BJP', margin: 19370 },
  { constNo: 186, name: 'Danapur', winnerName: 'Rit Lal Ray', winnerParty: 'RJD', runnerUpName: 'Asha Devi', runnerUpParty: 'BJP', margin: 15924 },
  { constNo: 187, name: 'Maner', winnerName: 'Bhai Virendra', winnerParty: 'RJD', runnerUpName: 'Nikhil Anand', runnerUpParty: 'BJP', margin: 32917 },
  { constNo: 188, name: 'Phulwari', winnerName: 'Gopal Ravidas', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Arun Manjhi', runnerUpParty: 'JD(U)', margin: 13857 },
  { constNo: 189, name: 'Masaurhi', winnerName: 'Rekha Devi', winnerParty: 'RJD', runnerUpName: 'Nutan Paswan', runnerUpParty: 'JD(U)', margin: 32227 },
  { constNo: 190, name: 'Paliganj', winnerName: 'Sandeep Saurav', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Jay Vardhan Yadav', runnerUpParty: 'JD(U)', margin: 30915 },
  { constNo: 191, name: 'Bikram', winnerName: 'Siddharth Saurav', winnerParty: 'INC', runnerUpName: 'Anil Kumar', runnerUpParty: 'IND', margin: 35460 },
  { constNo: 192, name: 'Sandesh', winnerName: 'Kiran Devi', winnerParty: 'RJD', runnerUpName: 'Vijayendra Yadav', runnerUpParty: 'JD(U)', margin: 50607 },
  { constNo: 193, name: 'Barhara', winnerName: 'Raghvendra Pratap Singh', winnerParty: 'BJP', runnerUpName: 'Saroj Yadav', runnerUpParty: 'RJD', margin: 4973 },
  { constNo: 194, name: 'Arrah', winnerName: 'Amrendra Pratap Singh', winnerParty: 'BJP', runnerUpName: 'Quyamuddin Ansari', runnerUpParty: 'CPI(ML)(L)', margin: 3002 },
  { constNo: 195, name: 'Agiaon', winnerName: 'Manoj Manzil', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Prabhunath Prasad', runnerUpParty: 'JD(U)', margin: 48550 },
  { constNo: 196, name: 'Tarari', winnerName: 'Sudama Prasad', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Narendra Kumar Pandey', runnerUpParty: 'IND', margin: 11015 },
  { constNo: 197, name: 'Jagdishpur', winnerName: 'Ram Vishun Singh', winnerParty: 'RJD', runnerUpName: 'Sribhagwan Singh Kushwaha', runnerUpParty: 'LJP', margin: 22107 },
  { constNo: 198, name: 'Shahpur', winnerName: 'Rahul Tiwary', winnerParty: 'RJD', runnerUpName: 'Shobha Devi', runnerUpParty: 'IND', margin: 22883 },
  { constNo: 199, name: 'Brahampur', winnerName: 'Shambhu Nath Yadav', winnerParty: 'RJD', runnerUpName: 'Hulas Pandey', runnerUpParty: 'LJP', margin: 51141 },
  { constNo: 200, name: 'Buxar', winnerName: 'Sanjay Kr. Tiwari', winnerParty: 'INC', runnerUpName: 'Parshuram Chaubey', runnerUpParty: 'BJP', margin: 3892 },
  { constNo: 201, name: 'Dumraon', winnerName: 'Ajit Kumar Singh', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Anjum Ara', runnerUpParty: 'JD(U)', margin: 24415 },
  { constNo: 202, name: 'Rajpur', winnerName: 'Vishwanath Ram', winnerParty: 'INC', runnerUpName: 'Santosh Kumar Nirala', runnerUpParty: 'JD(U)', margin: 21204 },
  { constNo: 203, name: 'Ramgarh', winnerName: 'Sudhakar Singh', winnerParty: 'RJD', runnerUpName: 'Ambika Singh', runnerUpParty: 'BSP', margin: 189 },
  { constNo: 204, name: 'Mohania', winnerName: 'Sangita Kumari', winnerParty: 'RJD', runnerUpName: 'Niranjan Ram', runnerUpParty: 'BJP', margin: 12054 },
  { constNo: 205, name: 'Bhabua', winnerName: 'Bharat Bind', winnerParty: 'RJD', runnerUpName: 'Rinki Rani Pandey', runnerUpParty: 'BJP', margin: 10045 },
  { constNo: 206, name: 'Chainpur', winnerName: 'Mohd. Zama Khan', winnerParty: 'BSP', runnerUpName: 'Brij Kishor Bind', runnerUpParty: 'BJP', margin: 24294 },
  { constNo: 207, name: 'Chenari', winnerName: 'Murari Prasad Gautam', winnerParty: 'INC', runnerUpName: 'Lalan Paswan', runnerUpParty: 'JD(U)', margin: 18003 },
  { constNo: 208, name: 'Sasaram', winnerName: 'Rajesh Kumar Gupta', winnerParty: 'RJD', runnerUpName: 'Ashok Kumar', runnerUpParty: 'JD(U)', margin: 26423 },
  { constNo: 209, name: 'Kargahar', winnerName: 'Santosh Kumar Mishra', winnerParty: 'INC', runnerUpName: 'Bashisth Singh', runnerUpParty: 'JD(U)', margin: 4083 },
  { constNo: 210, name: 'Dinara', winnerName: 'Vijay Kumar Mandal', winnerParty: 'RJD', runnerUpName: 'Rajendra Prasad Singh', runnerUpParty: 'LJP', margin: 8228 },
  { constNo: 211, name: 'Nokha', winnerName: 'Anita Devi', winnerParty: 'RJD', runnerUpName: 'Nagendra Chandrawansi', runnerUpParty: 'JD(U)', margin: 17672 },
  { constNo: 212, name: 'Dehri', winnerName: 'Phate Bahadur Singh', winnerParty: 'RJD', runnerUpName: 'Satyanarayan Singh', runnerUpParty: 'BJP', margin: 464 },
  { constNo: 213, name: 'Karakat', winnerName: 'Arun Singh', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Rajeshwar Raj', runnerUpParty: 'BJP', margin: 18189 },
  { constNo: 214, name: 'Arwal', winnerName: 'Maha Nand Singh', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Dipak Kumar Sharma', runnerUpParty: 'BJP', margin: 19950 },
  { constNo: 215, name: 'Kurtha', winnerName: 'Bagi Kumar Verma', winnerParty: 'RJD', runnerUpName: 'Satyadeo Singh', runnerUpParty: 'JD(U)', margin: 27810 },
  { constNo: 216, name: 'Jehanabad', winnerName: 'Kumar Krishna Mohan', winnerParty: 'RJD', runnerUpName: 'Krishannandan Prasad Verma', runnerUpParty: 'JD(U)', margin: 33902 },
  { constNo: 217, name: 'Ghosi', winnerName: 'Ram Bali Singh Yadav', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Rahul Kumar', runnerUpParty: 'JD(U)', margin: 17333 },
  { constNo: 218, name: 'Makhdumpur', winnerName: 'Satish Kumar', winnerParty: 'RJD', runnerUpName: 'Devendra Kumar', runnerUpParty: 'HAMS', margin: 22565 },
  { constNo: 219, name: 'Goh', winnerName: 'Bhim Kumar Singh', winnerParty: 'RJD', runnerUpName: 'Manoj Kumar', runnerUpParty: 'BJP', margin: 35618 },
  { constNo: 220, name: 'Obra', winnerName: 'Rishi Kumar', winnerParty: 'RJD', runnerUpName: 'Prakash Chandra', runnerUpParty: 'LJP', margin: 22668 },
  { constNo: 221, name: 'Nabinagar', winnerName: 'Vijay Kumar Singh Alias Dabloo Singh', winnerParty: 'RJD', runnerUpName: 'Virendra Kumar Singh', runnerUpParty: 'JD(U)', margin: 20121 },
  { constNo: 222, name: 'Kutumba', winnerName: 'Rajesh Kumar', winnerParty: 'INC', runnerUpName: 'Sharwan Bhuiya', runnerUpParty: 'HAMS', margin: 16653 },
  { constNo: 223, name: 'Aurangabad', winnerName: 'Anand Shankar Singh', winnerParty: 'INC', runnerUpName: 'Ramadhar Singh', runnerUpParty: 'BJP', margin: 2243 },
  { constNo: 224, name: 'Rafiganj', winnerName: 'Mohammad Nehaluddin', winnerParty: 'RJD', runnerUpName: 'Pramod Kumar Singh', runnerUpParty: 'IND', margin: 9429 },
  { constNo: 225, name: 'Gurua', winnerName: 'Vinay Kumar', winnerParty: 'RJD', runnerUpName: 'Rajiv Nandan', runnerUpParty: 'BJP', margin: 6599 },
  { constNo: 226, name: 'Sherghati', winnerName: 'Manju Agrawal', winnerParty: 'RJD', runnerUpName: 'Vinod Prasad Yadav', runnerUpParty: 'JD(U)', margin: 16690 },
  { constNo: 227, name: 'Imamganj', winnerName: 'Jitan Ram Manjhi', winnerParty: 'HAMS', runnerUpName: 'Uday Narain Choudhary', runnerUpParty: 'RJD', margin: 16034 },
  { constNo: 228, name: 'Barachatti', winnerName: 'Jyoti Devi', winnerParty: 'HAMS', runnerUpName: 'Samata Devi', runnerUpParty: 'RJD', margin: 6318 },
  { constNo: 229, name: 'Bodh Gaya', winnerName: 'Kumar Sarvjeet', winnerParty: 'RJD', runnerUpName: 'Hari Manjhi', runnerUpParty: 'BJP', margin: 4708 },
  { constNo: 230, name: 'Gaya Town', winnerName: 'Prem Kumar', winnerParty: 'BJP', runnerUpName: 'Akhauri Onkar Nath', runnerUpParty: 'INC', margin: 11898 },
  { constNo: 231, name: 'Tikari', winnerName: 'Anil Kumar', winnerParty: 'HAMS', runnerUpName: 'Sumant Kumar', runnerUpParty: 'INC', margin: 2630 },
  { constNo: 232, name: 'Belaganj', winnerName: 'Surendra Prasad Yadav', winnerParty: 'RJD', runnerUpName: 'Abhay Kumar Sinha', runnerUpParty: 'JD(U)', margin: 23963 },
  { constNo: 233, name: 'Atri', winnerName: 'Ajay Yadav', winnerParty: 'RJD', runnerUpName: 'Manorma Devi', runnerUpParty: 'JD(U)', margin: 7931 },
  { constNo: 234, name: 'Wazirganj', winnerName: 'Birendra Singh', winnerParty: 'BJP', runnerUpName: 'Shashi Shekhar Singh', runnerUpParty: 'INC', margin: 22430 },
  { constNo: 235, name: 'Rajauli', winnerName: 'Prakash Veer', winnerParty: 'RJD', runnerUpName: 'Kanhaiya Kumar', runnerUpParty: 'BJP', margin: 12593 },
  { constNo: 236, name: 'Hisua', winnerName: 'Nitu Kumari', winnerParty: 'INC', runnerUpName: 'Anil Singh', runnerUpParty: 'BJP', margin: 17091 },
  { constNo: 237, name: 'Nawada', winnerName: 'Vibha Devi', winnerParty: 'RJD', runnerUpName: 'Sharwan Kumar', runnerUpParty: 'IND', margin: 26310 },
  { constNo: 238, name: 'Gobindpur', winnerName: 'Md Kamran', winnerParty: 'RJD', runnerUpName: 'Purnima Yadav', runnerUpParty: 'JD(U)', margin: 33074 },
  { constNo: 239, name: 'Warsaliganj', winnerName: 'Aruna Devi', winnerParty: 'BJP', runnerUpName: 'Satish Kumar', runnerUpParty: 'INC', margin: 9030 },
  { constNo: 240, name: 'Sikandra', winnerName: 'Prafull Kumar Manjhi', winnerParty: 'HAMS', runnerUpName: 'Sudhir Kumar', runnerUpParty: 'INC', margin: 5505 },
  { constNo: 241, name: 'Jamui', winnerName: 'Shreyasi Singh', winnerParty: 'BJP', runnerUpName: 'Vijay Prakash', runnerUpParty: 'RJD', margin: 41049 },
  { constNo: 242, name: 'Jhajha', winnerName: 'Damodar Rawat', winnerParty: 'JD(U)', runnerUpName: 'Rajendra Prasad', runnerUpParty: 'RJD', margin: 1679 },
  { constNo: 243, name: 'Chakai', winnerName: 'Sumit Kumar Singh', winnerParty: 'IND', runnerUpName: 'Savitri Devi', runnerUpParty: 'RJD', margin: 581 },
];

function main() {
  console.log('=== Bihar Vidhan Sabha 2020 Seed Generator ===\n');

  const lines: string[] = [];
  lines.push('-- Bihar Vidhan Sabha 2020 Election Data');
  lines.push('-- Source: StatisticsTimes / ECI (winner + runner-up per constituency)');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_bihar_vs_2020.sql');
  lines.push('');

  // Collect all parties used
  const usedParties = new Set<string>();
  for (const row of RAW_DATA) {
    usedParties.add(row.winnerParty);
    usedParties.add(row.runnerUpParty);
  }

  // New parties not in existing seeds — only list parties confirmed in DB
  const newParties: { id: string; name: string; color: string }[] = [];
  const EXISTING_IN_SEED = new Set([
    'BJP', 'INC', 'JDU', 'RJD', 'LJPRV', 'HAM', 'BSP', 'AAP', 'CPIM', 'CPI',
    'AIMIM', 'AIFB', 'NCPSP', 'NCP', 'AP1', 'JMM', 'RLM', 'BP', 'IND', 'NOTA',
    'CPIML', 'HAMS',
  ]);

  /** Full party names for new party inserts */
  const PARTY_FULL_NAMES: Record<string, string> = {
    VSIP: 'Vikassheel Insaan Party',
    LJP: 'Lok Janshakti Party',
    JTVP: 'Jan Tantra Vikas Party',
  };

  for (const abbr of usedParties) {
    const id = PARTY_MAP[abbr];
    if (!id) {
      console.warn(`  WARNING: Unknown party abbreviation '${abbr}'`);
      continue;
    }
    if (!EXISTING_IN_SEED.has(id)) {
      newParties.push({ id, name: PARTY_FULL_NAMES[id] || abbr, color: PARTY_COLORS[id] || '#808080' });
    }
  }

  if (newParties.length > 0) {
    lines.push('-- New parties (not in existing seed)');
    for (const p of newParties) {
      lines.push(`INSERT INTO parties (id, name, color, symbol_url) VALUES ('${esc(p.id)}', '${esc(p.name)}', '${p.color}', NULL) ON CONFLICT (id) DO NOTHING;`);
    }
    lines.push('');
  }

  // Election
  lines.push('-- Election');
  lines.push(`INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date) VALUES`);
  lines.push(`  ('${ELECTION_ID}', 'Bihar Vidhan Sabha 2020', 'VS', ${STATE_ID}, 2020, 'Finalized', NULL)`);
  lines.push(`ON CONFLICT (id) DO NOTHING;`);
  lines.push('');

  // Constituencies
  lines.push(`-- Constituencies (${RAW_DATA.length})`);
  lines.push('INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES');
  const constLines: string[] = [];
  for (const row of RAW_DATA) {
    const constId = makeConstId(row.name, row.constNo);
    constLines.push(`  ('${esc(constId)}', '${ELECTION_ID}', NULL, ${STATE_ID}, '${esc(row.name)}', ${row.constNo}, 'GEN', NULL, NULL, NULL)`);
  }
  lines.push(constLines.join(',\n') + ';');
  lines.push('');

  // Candidates and Results (2 per constituency: winner + runner-up)
  lines.push('-- Candidates (winner + runner-up per constituency)');
  const candidateInserts: string[] = [];
  const resultInserts: string[] = [];
  let totalCandidates = 0;

  for (const row of RAW_DATA) {
    const constId = makeConstId(row.name, row.constNo);
    const winnerPartyId = PARTY_MAP[row.winnerParty] || 'IND';
    const runnerUpPartyId = PARTY_MAP[row.runnerUpParty] || 'IND';

    // Synthetic votes: winner gets margin + 50000, runner-up gets 50000
    const runnerUpVotes = 50000;
    const winnerVotes = runnerUpVotes + row.margin;

    // Winner
    const winCandId = randomUUID();
    candidateInserts.push(
      `  ('${winCandId}', NULL, '${ELECTION_ID}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(row.winnerName)}', FALSE, '{}')`
    );
    resultInserts.push(
      `  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${row.margin}, 0)`
    );
    totalCandidates++;

    // Runner-up
    const ruCandId = randomUUID();
    candidateInserts.push(
      `  ('${ruCandId}', NULL, '${ELECTION_ID}', '${esc(constId)}', '${esc(runnerUpPartyId)}', '${esc(row.runnerUpName)}', FALSE, '{}')`
    );
    resultInserts.push(
      `  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${row.margin}, 0)`
    );
    totalCandidates++;
  }

  lines.push('INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent, metadata) VALUES');
  lines.push(candidateInserts.join(',\n') + ';');
  lines.push('');

  lines.push('-- Results');
  lines.push('INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no) VALUES');
  lines.push(resultInserts.join(',\n') + ';');
  lines.push('');

  // Manifest
  const manifest = {
    alliances: [
      {
        id: 'NDA',
        name: 'National Democratic Alliance',
        color: '#FF6B00',
        parties: ['BJP', 'JDU', 'LJP', 'HAMS'],
      },
      {
        id: 'MGB',
        name: 'Mahagathbandhan',
        color: '#2E8B57',
        parties: ['RJD', 'INC', 'CPI', 'CPIM', 'CPIML'],
      },
    ],
    leaders: [
      { name: 'Nitish Kumar', party_id: 'JDU', const_id: '' },
      { name: 'Tejashwi Yadav', party_id: 'RJD', const_id: '' },
    ],
    cabinet: [],
    tracked: ['NDA', 'MGB', 'AIMIM', 'BSP'],
    vip_seats: {},
    milestones: [{ label: 'Majority', value: 122 }],
    compare_with: ['a1b2c3d4-e5f6-7890-abcd-111111111015'],
    geo: {
      map_url: '/geo/bihar_ac.geojson',
      center: [85.5, 25.6] as [number, number],
      zoom: 8,
    },
    delimitation_era: '2008',
  };

  lines.push('-- Manifest');
  lines.push(`UPDATE elections SET manifest_url = '${esc(JSON.stringify(manifest))}' WHERE id = '${ELECTION_ID}';`);
  lines.push('');

  // Write file
  const outPath = path.resolve(__dirname, '../../database/seed_bihar_vs_2020.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Done! Wrote ${outPath}`);
  console.log(`  ${RAW_DATA.length} constituencies`);
  console.log(`  ${totalCandidates} candidates`);
}

main();
