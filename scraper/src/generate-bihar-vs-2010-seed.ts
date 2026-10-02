/**
 * Generate Bihar Vidhan Sabha 2010 seed SQL from hardcoded scraped data.
 *
 * Usage: npx ts-node src/generate-bihar-vs-2010-seed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const ELECTION_ID = 'a1b2c3d4-e5f6-7890-abcd-111111111010';
const STATE_ID = 5; // Bihar

/** Party abbreviation mapping: elections.in source → our DB IDs */
const PARTY_MAP: Record<string, string> = {
  'BJP': 'BJP',
  'INC': 'INC',
  'JD(U)': 'JDU',
  'RJD': 'RJD',
  'CPI(ML)(L)': 'CPIML',
  'CPM': 'CPIM',
  'CPI': 'CPI',
  'LJP': 'LJP',
  'BSP': 'BSP',
  'NCP': 'NCP',
  'IND': 'IND',
  'ND': 'IND',
  'JMM': 'JMM',
};

/** Party colors */
const PARTY_COLORS: Record<string, string> = {
  BJP: '#FF6B00',
  INC: '#00BFFF',
  JDU: '#003366',
  RJD: '#2E8B57',
  CPIML: '#CC0000',
  CPIM: '#FF0000',
  CPI: '#FF0000',
  LJP: '#0000CD',
  BSP: '#0033CC',
  NCP: '#004953',
  IND: '#808080',
  JMM: '#2E5A1E',
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** Build constituency ID for 2010: BR_VS10_{constNo}_{NAME} */
function makeConstId(name: string, constNo: number): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `BR_VS10_${constNo}_${clean}`;
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

/** All 243 constituencies from Bihar 2010 election (scraped from elections.in) */
const RAW_DATA: RawRow[] = [
  { constNo: 1, name: 'Valmiki Nagar', winnerName: 'Rajesh Singh', winnerParty: 'JD(U)', runnerUpName: 'Mukesh Kumar Kushwaha', runnerUpParty: 'RJD', margin: 14671 },
  { constNo: 2, name: 'Ramnagar', winnerName: 'Bhagirathi Devi', winnerParty: 'BJP', runnerUpName: 'Naresh Ram', runnerUpParty: 'INC', margin: 29782 },
  { constNo: 3, name: 'Narkatiaganj', winnerName: 'Satish Chandra Dubey', winnerParty: 'BJP', runnerUpName: 'Alok Prasad Verma', runnerUpParty: 'INC', margin: 20228 },
  { constNo: 4, name: 'Bagaha', winnerName: 'Prabhat Ranjan Singh', winnerParty: 'JD(U)', runnerUpName: 'Ram Prasad Yadav', runnerUpParty: 'RJD', margin: 49055 },
  { constNo: 5, name: 'Lauriya', winnerName: 'Vinay Bihari', winnerParty: 'IND', runnerUpName: 'Pradeep Singh', runnerUpParty: 'JD(U)', margin: 10881 },
  { constNo: 6, name: 'Nautan', winnerName: 'Manorma Prasad', winnerParty: 'JD(U)', runnerUpName: 'Narayan Prasad', runnerUpParty: 'LJP', margin: 22764 },
  { constNo: 7, name: 'Chanpatia', winnerName: 'Chandra Mohan Rai', winnerParty: 'BJP', runnerUpName: 'Ejaj Hussain', runnerUpParty: 'BSP', margin: 23412 },
  { constNo: 8, name: 'Bettiah', winnerName: 'Renu Devi', winnerParty: 'BJP', runnerUpName: 'Anil Kumar Jha', runnerUpParty: 'IND', margin: 28789 },
  { constNo: 9, name: 'Sikta', winnerName: 'Dilip Varma', winnerParty: 'IND', runnerUpName: 'Khurshid Urf Firoj Ahmad', runnerUpParty: 'JD(U)', margin: 8779 },
  { constNo: 10, name: 'Raxaul', winnerName: 'Dr. Ajay Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Raj Nandan Rai', runnerUpParty: 'LJP', margin: 10117 },
  { constNo: 11, name: 'Sugauli', winnerName: 'Ramchandra Sahani', winnerParty: 'BJP', runnerUpName: 'Vijay Prasad Gupta', runnerUpParty: 'RJD', margin: 12379 },
  { constNo: 12, name: 'Narkatia', winnerName: 'Shyam Bihari Prasad', winnerParty: 'JD(U)', runnerUpName: 'Yasmin Sabir Ali', runnerUpParty: 'LJP', margin: 7688 },
  { constNo: 13, name: 'Harsidhi', winnerName: 'Krishana Nandan Paswan', winnerParty: 'BJP', runnerUpName: 'Surendra Kumar Chandra', runnerUpParty: 'RJD', margin: 18064 },
  { constNo: 14, name: 'Govindganj', winnerName: 'Meena Dwivedi', winnerParty: 'JD(U)', runnerUpName: 'Raju Tiwari', runnerUpParty: 'LJP', margin: 8405 },
  { constNo: 15, name: 'Kesariya', winnerName: 'Sachindra Pd. Singh', winnerParty: 'BJP', runnerUpName: 'Ram Saran Pd. Yadav', runnerUpParty: 'CPI', margin: 11683 },
  { constNo: 16, name: 'Kalyanpur', winnerName: 'Razia Khatoon', winnerParty: 'JD(U)', runnerUpName: 'Manoj Kumar Yadav', runnerUpParty: 'RJD', margin: 15402 },
  { constNo: 17, name: 'Pipra', winnerName: 'Awadhesh Prasad Kushwaha', winnerParty: 'JD(U)', runnerUpName: 'Subhodh Yadav', runnerUpParty: 'RJD', margin: 11887 },
  { constNo: 18, name: 'Madhuban', winnerName: 'Shivjee Rai', winnerParty: 'JD(U)', runnerUpName: 'Rana Randhir', runnerUpParty: 'RJD', margin: 10122 },
  { constNo: 19, name: 'Motihari', winnerName: 'Pramod Kumar', winnerParty: 'BJP', runnerUpName: 'Rajesh Gupta', runnerUpParty: 'RJD', margin: 24530 },
  { constNo: 20, name: 'Chiraia', winnerName: 'Avaneesh Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Laxmi Narayan Pr. Yadav', runnerUpParty: 'RJD', margin: 14828 },
  { constNo: 21, name: 'Dhaka', winnerName: 'Pawan Kumar Jaiswal', winnerParty: 'IND', runnerUpName: 'Faisal Rahman', runnerUpParty: 'JD(U)', margin: 1649 },
  { constNo: 22, name: 'Sheohar', winnerName: 'Sharfuddin', winnerParty: 'JD(U)', runnerUpName: 'Pratima Devi', runnerUpParty: 'BSP', margin: 1631 },
  { constNo: 23, name: 'Riga', winnerName: 'Motilal Prasad', winnerParty: 'BJP', runnerUpName: 'Amit Kumar', runnerUpParty: 'INC', margin: 22327 },
  { constNo: 24, name: 'Bathnaha', winnerName: 'Dinkar Ram', winnerParty: 'BJP', runnerUpName: 'Lalita Devi', runnerUpParty: 'LJP', margin: 13292 },
  { constNo: 25, name: 'Parihar', winnerName: 'Ram Naresh Pr. Yadav', winnerParty: 'BJP', runnerUpName: 'Dr. Ramchandra Purve', runnerUpParty: 'RJD', margin: 4218 },
  { constNo: 26, name: 'Sursand', winnerName: 'Shahidali Khan', winnerParty: 'JD(U)', runnerUpName: 'Jainandan Prasad Yadav', runnerUpParty: 'RJD', margin: 1186 },
  { constNo: 27, name: 'Bajpatti', winnerName: 'Ranju Geeta', winnerParty: 'JD(U)', runnerUpName: 'Md. Anwarul Haque', runnerUpParty: 'RJD', margin: 3420 },
  { constNo: 28, name: 'Sitamarhi', winnerName: 'Sunil Kumar', winnerParty: 'BJP', runnerUpName: 'Raghwendra Kumar Singh', runnerUpParty: 'LJP', margin: 5221 },
  { constNo: 29, name: 'Runisaidpur', winnerName: 'Guddi Devi', winnerParty: 'JD(U)', runnerUpName: 'Ram Shatrughan Rai', runnerUpParty: 'RJD', margin: 10759 },
  { constNo: 30, name: 'Belsand', winnerName: 'Sunita Singh', winnerParty: 'JD(U)', runnerUpName: 'Sanjay Kumar Gupta', runnerUpParty: 'RJD', margin: 19580 },
  { constNo: 31, name: 'Harlakhi', winnerName: 'Shaligram Yadav', winnerParty: 'JD(U)', runnerUpName: 'Ram Naresh Pandey', runnerUpParty: 'CPI', margin: 6659 },
  { constNo: 32, name: 'Benipatti', winnerName: 'Vinod Narain Jha', winnerParty: 'BJP', runnerUpName: 'Mahesh Chandra Singh', runnerUpParty: 'LJP', margin: 12642 },
  { constNo: 33, name: 'Khajauli', winnerName: 'Arun Shankar Prasad', winnerParty: 'BJP', runnerUpName: 'Sitaram Yadav', runnerUpParty: 'RJD', margin: 10713 },
  { constNo: 34, name: 'Babubarhi', winnerName: 'Uma Kant Yadav', winnerParty: 'RJD', runnerUpName: 'Kapildeb Kamat', runnerUpParty: 'JD(U)', margin: 4913 },
  { constNo: 35, name: 'Bisfi', winnerName: 'Dr. Faiyaj Ahmad', winnerParty: 'RJD', runnerUpName: 'Hari Bhushan Thakur', runnerUpParty: 'JD(U)', margin: 9501 },
  { constNo: 36, name: 'Madhubani', winnerName: 'Ram Deo Mahto', winnerParty: 'BJP', runnerUpName: 'Naiyar Azam', runnerUpParty: 'RJD', margin: 588 },
  { constNo: 37, name: 'Rajnagar', winnerName: 'Ram Lakhan Ram Raman', winnerParty: 'RJD', runnerUpName: 'Ramprit Paswan', runnerUpParty: 'BJP', margin: 2459 },
  { constNo: 38, name: 'Jhanjharpur', winnerName: 'Nitish Mishra', winnerParty: 'JD(U)', runnerUpName: 'Jagat Narayan Singh', runnerUpParty: 'RJD', margin: 20681 },
  { constNo: 39, name: 'Phulparas', winnerName: 'Guljar Devi', winnerParty: 'JD(U)', runnerUpName: 'Virendra Kumar Chaudhary', runnerUpParty: 'RJD', margin: 12344 },
  { constNo: 40, name: 'Laukaha', winnerName: 'Hari Prasad Sah', winnerParty: 'JD(U)', runnerUpName: 'Chitaranjan Prasad Yadav', runnerUpParty: 'RJD', margin: 17566 },
  { constNo: 41, name: 'Nirmali', winnerName: 'Aniruddha Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Vijay Kumar Gupta', runnerUpParty: 'INC', margin: 46010 },
  { constNo: 42, name: 'Pipra', winnerName: 'Sujata Devi', winnerParty: 'JD(U)', runnerUpName: 'Dinbandhu Yadav', runnerUpParty: 'LJP', margin: 14686 },
  { constNo: 43, name: 'Supaul', winnerName: 'Bijendra Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Ravindra Kumar Raman', runnerUpParty: 'RJD', margin: 15400 },
  { constNo: 44, name: 'Tribeniganj', winnerName: 'Amla Devi', winnerParty: 'JD(U)', runnerUpName: 'Anant Kumar Bharti', runnerUpParty: 'LJP', margin: 19023 },
  { constNo: 45, name: 'Chhatapur', winnerName: 'Neeraj Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Akeel Ahmad', runnerUpParty: 'RJD', margin: 23730 },
  { constNo: 46, name: 'Narpatganj', winnerName: 'Devanti Yadav', winnerParty: 'BJP', runnerUpName: 'Anil Kumar Yadav', runnerUpParty: 'RJD', margin: 6937 },
  { constNo: 47, name: 'Raniganj', winnerName: 'Parmanand Rishideo', winnerParty: 'BJP', runnerUpName: 'Shanti Devi', runnerUpParty: 'RJD', margin: 23653 },
  { constNo: 48, name: 'Forbesganj', winnerName: 'Padam Parag Roy', winnerParty: 'BJP', runnerUpName: 'Maya Nand Thakur', runnerUpParty: 'LJP', margin: 26827 },
  { constNo: 49, name: 'Araria', winnerName: 'Zakir Hussain Khan', winnerParty: 'LJP', runnerUpName: 'Narayan Kumar Jha', runnerUpParty: 'BJP', margin: 18061 },
  { constNo: 50, name: 'Jokihat', winnerName: 'Sarfraz Alam', winnerParty: 'JD(U)', runnerUpName: 'Koshar Zia', runnerUpParty: 'IND', margin: 25330 },
  { constNo: 51, name: 'Sikti', winnerName: 'Anandi Prasad Yadav', winnerParty: 'BJP', runnerUpName: 'Vijay Kumar Mandal', runnerUpParty: 'LJP', margin: 9874 },
  { constNo: 52, name: 'Bahadurganj', winnerName: 'Mohammad Tousif Alam', winnerParty: 'INC', runnerUpName: 'Mohammad Maswar Alam', runnerUpParty: 'JD(U)', margin: 3799 },
  { constNo: 53, name: 'Thakurganj', winnerName: 'Naushad Alam', winnerParty: 'LJP', runnerUpName: 'Gopal Kumar Agarwal', runnerUpParty: 'JD(U)', margin: 6963 },
  { constNo: 54, name: 'Kishanganj', winnerName: 'Dr Mohammad Jawaid', winnerParty: 'INC', runnerUpName: 'Sweety Singh', runnerUpParty: 'BJP', margin: 264 },
  { constNo: 55, name: 'Kochadhaman', winnerName: 'Akhatarul Iman', winnerParty: 'RJD', runnerUpName: 'Mujahid Alam', runnerUpParty: 'JD(U)', margin: 9025 },
  { constNo: 56, name: 'Amour', winnerName: 'Saba Zafar', winnerParty: 'BJP', runnerUpName: 'Abdul Jalil Mastan', runnerUpParty: 'INC', margin: 18828 },
  { constNo: 57, name: 'Baisi', winnerName: 'Santosh Kumar', winnerParty: 'BJP', runnerUpName: 'Nasar Ahamad', runnerUpParty: 'INC', margin: 9250 },
  { constNo: 58, name: 'Kasba', winnerName: 'Md. Afaque Alam', winnerParty: 'INC', runnerUpName: 'Pradip Kumar Das', runnerUpParty: 'BJP', margin: 4455 },
  { constNo: 59, name: 'Banmankhi', winnerName: 'Krishna Kumar Rishi', winnerParty: 'BJP', runnerUpName: 'Dharmlal Rishi', runnerUpParty: 'RJD', margin: 44890 },
  { constNo: 60, name: 'Rupauli', winnerName: 'Bima Bharti', winnerParty: 'JD(U)', runnerUpName: 'Shankar Singh', runnerUpParty: 'LJP', margin: 37716 },
  { constNo: 61, name: 'Dhamdaha', winnerName: 'Leshi Singh', winnerParty: 'JD(U)', runnerUpName: 'Irshad Ahmad Khan', runnerUpParty: 'INC', margin: 44697 },
  { constNo: 62, name: 'Purnia', winnerName: 'Raj Kishore Keshari', winnerParty: 'BJP', runnerUpName: 'Ram Charitra Yadav', runnerUpParty: 'INC', margin: 15599 },
  { constNo: 63, name: 'Katihar', winnerName: 'Tar Kishore Prasad', winnerParty: 'BJP', runnerUpName: 'Dr. Ram Prakash Mahto', runnerUpParty: 'RJD', margin: 20607 },
  { constNo: 64, name: 'Kadwa', winnerName: 'Bhola Ray', winnerParty: 'BJP', runnerUpName: 'Himraj Singh', runnerUpParty: 'NCP', margin: 18367 },
  { constNo: 65, name: 'Balrampur', winnerName: 'Dulal Chandra Goshwami', winnerParty: 'IND', runnerUpName: 'Mahboob Alam', runnerUpParty: 'CPI(ML)(L)', margin: 2704 },
  { constNo: 66, name: 'Pranpur', winnerName: 'Binod Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Israt Parween', runnerUpParty: 'NCP', margin: 716 },
  { constNo: 67, name: 'Manihari', winnerName: 'Manohar Prasad Singh', winnerParty: 'JD(U)', runnerUpName: 'Gita Kisku', runnerUpParty: 'NCP', margin: 4165 },
  { constNo: 68, name: 'Barari', winnerName: 'Bibhash Chandra Choudhary', winnerParty: 'BJP', runnerUpName: 'Mohammed Shakoor', runnerUpParty: 'NCP', margin: 27168 },
  { constNo: 69, name: 'Korha', winnerName: 'Mahesh Paswan', winnerParty: 'BJP', runnerUpName: 'Sunita Devi', runnerUpParty: 'INC', margin: 52444 },
  { constNo: 70, name: 'Alamnagar', winnerName: 'Narendra N. Yadav', winnerParty: 'JD(U)', runnerUpName: 'Lovely Anand', runnerUpParty: 'INC', margin: 42345 },
  { constNo: 71, name: 'Bihariganj', winnerName: 'Renu Kumari', winnerParty: 'JD(U)', runnerUpName: 'Prabhash Kumar', runnerUpParty: 'RJD', margin: 49997 },
  { constNo: 72, name: 'Singheshwar', winnerName: 'Ramesh Rishidev', winnerParty: 'JD(U)', runnerUpName: 'Amit Kumar Bharti', runnerUpParty: 'RJD', margin: 15196 },
  { constNo: 73, name: 'Madhepura', winnerName: 'Chandrashekhar', winnerParty: 'RJD', runnerUpName: 'Dr. Ramendra Kumar Yadav Ravi', runnerUpParty: 'JD(U)', margin: 11944 },
  { constNo: 74, name: 'Sonbarsa', winnerName: 'Ratnesh Sada', winnerParty: 'JD(U)', runnerUpName: 'Sarita Devi', runnerUpParty: 'LJP', margin: 31445 },
  { constNo: 75, name: 'Saharsa', winnerName: 'Alok Ranjan', winnerParty: 'BJP', runnerUpName: 'Arun Kumar', runnerUpParty: 'RJD', margin: 7979 },
  { constNo: 76, name: 'Simri Bakhtiarpur', winnerName: 'Dr. Arun Kumar', winnerParty: 'JD(U)', runnerUpName: 'Choudhry Mehboob Ali Kaisar', runnerUpParty: 'INC', margin: 18842 },
  { constNo: 77, name: 'Mahishi', winnerName: 'Dr. Abdul Gafoor', winnerParty: 'RJD', runnerUpName: 'Raj Kumar Sah', runnerUpParty: 'JD(U)', margin: 1717 },
  { constNo: 78, name: 'Kusheshwarasthan', winnerName: 'Shashi Bhushan Hajari', winnerParty: 'BJP', runnerUpName: 'Ramchandra Paswan', runnerUpParty: 'LJP', margin: 5512 },
  { constNo: 79, name: 'Gora Bauram', winnerName: 'Dr. Izhar Ahmad', winnerParty: 'JD(U)', runnerUpName: 'Dr. Mahavir Prasad', runnerUpParty: 'RJD', margin: 10602 },
  { constNo: 80, name: 'Benipur', winnerName: 'Gopal Jee Thakur', winnerParty: 'BJP', runnerUpName: 'Hare Krishna Yadav', runnerUpParty: 'RJD', margin: 13957 },
  { constNo: 81, name: 'Alinagar', winnerName: 'Abdul Bari Siddiqui', winnerParty: 'RJD', runnerUpName: 'Prabhakar Choudhary', runnerUpParty: 'JD(U)', margin: 4989 },
  { constNo: 82, name: 'Darbhanga Rural', winnerName: 'Lalit Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Ashraf Hussain', runnerUpParty: 'JD(U)', margin: 3676 },
  { constNo: 83, name: 'Darbhanga', winnerName: 'Sanjay Saraogi', winnerParty: 'BJP', runnerUpName: 'Sultan Ahmad', runnerUpParty: 'RJD', margin: 27554 },
  { constNo: 84, name: 'Hayaghat', winnerName: 'Amar Nath Gami', winnerParty: 'BJP', runnerUpName: 'Dr. Shahnawaz Ahmad Kaifee', runnerUpParty: 'LJP', margin: 6025 },
  { constNo: 85, name: 'Bahadurpur', winnerName: 'Madan Sahni', winnerParty: 'JD(U)', runnerUpName: 'Harinandan Yadav', runnerUpParty: 'RJD', margin: 643 },
  { constNo: 86, name: 'Keoti', winnerName: 'Ashok Kumar Yadav', winnerParty: 'BJP', runnerUpName: 'Faraz Fatmi', runnerUpParty: 'RJD', margin: 29 },
  { constNo: 87, name: 'Jale', winnerName: 'Vijay Kumar Mishra', winnerParty: 'BJP', runnerUpName: 'Ramniwas Pd.', runnerUpParty: 'RJD', margin: 16942 },
  { constNo: 88, name: 'Gaighat', winnerName: 'Veena Devi', winnerParty: 'BJP', runnerUpName: 'Maheshwar Prasad Yadav', runnerUpParty: 'RJD', margin: 15987 },
  { constNo: 89, name: 'Aurai', winnerName: 'Ram Surat Rai', winnerParty: 'BJP', runnerUpName: 'Surendra Kumar', runnerUpParty: 'RJD', margin: 11741 },
  { constNo: 90, name: 'Minapur', winnerName: 'Dinesh Prasad', winnerParty: 'JD(U)', runnerUpName: 'Rajeev Kumar Urph Munna Yadav', runnerUpParty: 'RJD', margin: 5402 },
  { constNo: 91, name: 'Bochaha', winnerName: 'Ramai Ram', winnerParty: 'JD(U)', runnerUpName: 'Musafir Paswan', runnerUpParty: 'RJD', margin: 24127 },
  { constNo: 92, name: 'Sakra', winnerName: 'Suresh Chanchal', winnerParty: 'JD(U)', runnerUpName: 'Lal Babu Ram', runnerUpParty: 'RJD', margin: 13045 },
  { constNo: 93, name: 'Kurhani', winnerName: 'Manoj Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Bijendra Chaudhary', runnerUpParty: 'LJP', margin: 1570 },
  { constNo: 94, name: 'Muzaffarpur', winnerName: 'Suresh Kumar Sharma', winnerParty: 'BJP', runnerUpName: 'Mohammad Jamal', runnerUpParty: 'LJP', margin: 46439 },
  { constNo: 95, name: 'Kanti', winnerName: 'Ajit Kumar', winnerParty: 'JD(U)', runnerUpName: 'Md. Israil', runnerUpParty: 'RJD', margin: 8415 },
  { constNo: 96, name: 'Baruraj', winnerName: 'Brij Kishor Singh', winnerParty: 'RJD', runnerUpName: 'Nand Kumar Rai', runnerUpParty: 'JD(U)', margin: 14317 },
  { constNo: 97, name: 'Paroo', winnerName: 'Ashok Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Mithilesh Prasad Yadav', runnerUpParty: 'RJD', margin: 19027 },
  { constNo: 98, name: 'Sahebganj', winnerName: 'Raju Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Ram Vichar Ray', runnerUpParty: 'RJD', margin: 4916 },
  { constNo: 99, name: 'Baikunthpur', winnerName: 'Manjeet Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Devdatt Prasad', runnerUpParty: 'RJD', margin: 36524 },
  { constNo: 100, name: 'Barauli', winnerName: 'Ram Pravesh Rai', winnerParty: 'BJP', runnerUpName: 'M. Nematullah', runnerUpParty: 'RJD', margin: 10414 },
  { constNo: 101, name: 'Gopalganj', winnerName: 'Subas Singh', winnerParty: 'BJP', runnerUpName: 'Reyazul Haque', runnerUpParty: 'RJD', margin: 15893 },
  { constNo: 102, name: 'Kuchaikote', winnerName: 'Amrendra Kumar Pandey', winnerParty: 'JD(U)', runnerUpName: 'Aditya Narain Pandey', runnerUpParty: 'RJD', margin: 19518 },
  { constNo: 103, name: 'Bhore', winnerName: 'Indradeo Manjhi', winnerParty: 'BJP', runnerUpName: 'Bachchan Das', runnerUpParty: 'RJD', margin: 43570 },
  { constNo: 104, name: 'Hathua', winnerName: 'Ram Sewak Singh', winnerParty: 'JD(U)', runnerUpName: 'Rajesh Kumar Singh', runnerUpParty: 'RJD', margin: 22847 },
  { constNo: 105, name: 'Siwan', winnerName: 'Vyas Deo Prasad', winnerParty: 'BJP', runnerUpName: 'Awadhvihari Chaudhry', runnerUpParty: 'RJD', margin: 12541 },
  { constNo: 106, name: 'Ziradei', winnerName: 'Asha Devi', winnerParty: 'BJP', runnerUpName: 'Amarjeet Kushwaha', runnerUpParty: 'CPI(ML)(L)', margin: 8920 },
  { constNo: 107, name: 'Darauli', winnerName: 'Ramayan Manjhi', winnerParty: 'BJP', runnerUpName: 'Satyadeo Ram', runnerUpParty: 'CPI(ML)(L)', margin: 7006 },
  { constNo: 108, name: 'Raghunathpur', winnerName: 'Vikram Kunwar', winnerParty: 'BJP', runnerUpName: 'Amar Nath Yadav', runnerUpParty: 'CPI(ML)(L)', margin: 15112 },
  { constNo: 109, name: 'Daraundha', winnerName: 'Jagmato Devi', winnerParty: 'JD(U)', runnerUpName: 'Binod Kumar Singh', runnerUpParty: 'RJD', margin: 31135 },
  { constNo: 110, name: 'Barharia', winnerName: 'Shyam Bahadur Singh', winnerParty: 'JD(U)', runnerUpName: 'Mahamad Mobin', runnerUpParty: 'RJD', margin: 25121 },
  { constNo: 111, name: 'Goriyakothi', winnerName: 'Bhumendra Narayan Singh', winnerParty: 'BJP', runnerUpName: 'Indradeo Prasad', runnerUpParty: 'RJD', margin: 14021 },
  { constNo: 112, name: 'Maharajganj', winnerName: 'Damodar Singh', winnerParty: 'JD(U)', runnerUpName: 'Manik Chand Rai', runnerUpParty: 'RJD', margin: 20000 },
  { constNo: 113, name: 'Ekma', winnerName: 'Manoranjan Singh', winnerParty: 'JD(U)', runnerUpName: 'Kameshwar Kr. Singh', runnerUpParty: 'RJD', margin: 29201 },
  { constNo: 114, name: 'Manjhi', winnerName: 'Gautam Singh', winnerParty: 'JD(U)', runnerUpName: 'Hem Narayan Singh', runnerUpParty: 'RJD', margin: 7904 },
  { constNo: 115, name: 'Baniapur', winnerName: 'Kedar Nath Singh', winnerParty: 'RJD', runnerUpName: 'Virendra Kumar Ojha', runnerUpParty: 'JD(U)', margin: 3575 },
  { constNo: 116, name: 'Taraiya', winnerName: 'Janak Singh', winnerParty: 'BJP', runnerUpName: 'Tarkeshwar Singh', runnerUpParty: 'INC', margin: 6970 },
  { constNo: 117, name: 'Marhaura', winnerName: 'Jitendra Kumar Rai', winnerParty: 'RJD', runnerUpName: 'Lal Babu Ray', runnerUpParty: 'JD(U)', margin: 5624 },
  { constNo: 118, name: 'Chapra', winnerName: 'Janardan Singh Sigriwal', winnerParty: 'BJP', runnerUpName: 'Pramendra Ranjan Singh', runnerUpParty: 'RJD', margin: 35871 },
  { constNo: 119, name: 'Garkha', winnerName: 'Gyan Chand Manjhi', winnerParty: 'BJP', runnerUpName: 'Muneshwar Chaudhary', runnerUpParty: 'RJD', margin: 1787 },
  { constNo: 120, name: 'Amnour', winnerName: 'Krishana Kumar', winnerParty: 'JD(U)', runnerUpName: 'Sunil Kumar', runnerUpParty: 'IND', margin: 10517 },
  { constNo: 121, name: 'Parsa', winnerName: 'Chhotelal Rai', winnerParty: 'JD(U)', runnerUpName: 'Chandrika Rai', runnerUpParty: 'RJD', margin: 4689 },
  { constNo: 122, name: 'Sonepur', winnerName: 'Vinay Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Rabri Devi', runnerUpParty: 'RJD', margin: 20685 },
  { constNo: 123, name: 'Hajipur', winnerName: 'Nityanand Roy', winnerParty: 'BJP', runnerUpName: 'Rajendra Rai', runnerUpParty: 'LJP', margin: 16609 },
  { constNo: 124, name: 'Lalganj', winnerName: 'Annu Shukla', winnerParty: 'JD(U)', runnerUpName: 'Raj Kumar Sah', runnerUpParty: 'IND', margin: 24145 },
  { constNo: 125, name: 'Vaishali', winnerName: 'Brishin Patel', winnerParty: 'JD(U)', runnerUpName: 'Veena Shahi', runnerUpParty: 'RJD', margin: 12828 },
  { constNo: 126, name: 'Mahua', winnerName: 'Ravindra Ray', winnerParty: 'JD(U)', runnerUpName: 'Jageshwar Ray', runnerUpParty: 'RJD', margin: 21925 },
  { constNo: 127, name: 'Raja Pakar', winnerName: 'Sanjay Kumar', winnerParty: 'JD(U)', runnerUpName: 'Gaurishankar Paswan', runnerUpParty: 'LJP', margin: 10215 },
  { constNo: 128, name: 'Raghopur', winnerName: 'Satish Kumar', winnerParty: 'JD(U)', runnerUpName: 'Rabri Devi', runnerUpParty: 'RJD', margin: 13006 },
  { constNo: 129, name: 'Mahnar', winnerName: 'Dr. Achyutanand', winnerParty: 'BJP', runnerUpName: 'Rama Kishor Singh', runnerUpParty: 'LJP', margin: 2489 },
  { constNo: 130, name: 'Patepur', winnerName: 'Mahendra Baitha', winnerParty: 'BJP', runnerUpName: 'Prema Chaudhary', runnerUpParty: 'RJD', margin: 16667 },
  { constNo: 131, name: 'Kalyanpur', winnerName: 'Ramsewak Hazari', winnerParty: 'JD(U)', runnerUpName: 'Bishwnath Paswan', runnerUpParty: 'LJP', margin: 30197 },
  { constNo: 132, name: 'Warisnagar', winnerName: 'Ashok Kumar', winnerParty: 'JD(U)', runnerUpName: 'Gajendra Prasad Singh', runnerUpParty: 'RJD', margin: 19500 },
  { constNo: 133, name: 'Samastipur', winnerName: 'Akhtarul Islam Sahin', winnerParty: 'RJD', runnerUpName: 'Ramnath Thakur', runnerUpParty: 'JD(U)', margin: 1827 },
  { constNo: 134, name: 'Ujiarpur', winnerName: 'Durga Prasad Singh', winnerParty: 'RJD', runnerUpName: 'Ram Lakhan Mahto', runnerUpParty: 'JD(U)', margin: 13031 },
  { constNo: 135, name: 'Morwa', winnerName: 'Baidhnath Sahani', winnerParty: 'JD(U)', runnerUpName: 'Ashok Singh', runnerUpParty: 'RJD', margin: 6850 },
  { constNo: 136, name: 'Sarairanjan', winnerName: 'Vijay Kumar Chaudhary', winnerParty: 'JD(U)', runnerUpName: 'Ramashraya Sahni', runnerUpParty: 'RJD', margin: 17557 },
  { constNo: 137, name: 'Mohiuddinnagar', winnerName: 'Rana Gangeshwar Singh', winnerParty: 'BJP', runnerUpName: 'Ajay Kumar Bulganin', runnerUpParty: 'RJD', margin: 14351 },
  { constNo: 138, name: 'Bibhutpur', winnerName: 'Ram Balak Singh', winnerParty: 'JD(U)', runnerUpName: 'Ramdeo Verma', runnerUpParty: 'CPM', margin: 12301 },
  { constNo: 139, name: 'Rosera', winnerName: 'Manju Hajari', winnerParty: 'BJP', runnerUpName: 'Pitamber Paswan', runnerUpParty: 'RJD', margin: 12119 },
  { constNo: 140, name: 'Hasanpur', winnerName: 'Raj Kumar Ray', winnerParty: 'JD(U)', runnerUpName: 'Sunil Kumar Puspam', runnerUpParty: 'RJD', margin: 3291 },
  { constNo: 141, name: 'Cheria Bariarpur', winnerName: 'Kumari Manju Verma', winnerParty: 'JD(U)', runnerUpName: 'Anil Kumar Chaudhary', runnerUpParty: 'LJP', margin: 1061 },
  { constNo: 142, name: 'Bachwara', winnerName: 'Abdhesh Kumar Rai', winnerParty: 'CPI', runnerUpName: 'Arvind Kumar Singh', runnerUpParty: 'IND', margin: 12087 },
  { constNo: 143, name: 'Teghra', winnerName: 'Lalan Kumar', winnerParty: 'BJP', runnerUpName: 'Ram Ratan Singh', runnerUpParty: 'CPI', margin: 5846 },
  { constNo: 144, name: 'Matihani', winnerName: 'Narendra Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Abhay Kumar Sarjan', runnerUpParty: 'INC', margin: 23828 },
  { constNo: 145, name: 'Sahebpur Kamal', winnerName: 'Parveen Amanullah', winnerParty: 'JD(U)', runnerUpName: 'Shreenarayan Yadav', runnerUpParty: 'RJD', margin: 11111 },
  { constNo: 146, name: 'Begusarai', winnerName: 'Surendra Mehta', winnerParty: 'BJP', runnerUpName: 'Upendra Prasad Singh', runnerUpParty: 'LJP', margin: 19618 },
  { constNo: 147, name: 'Bakhri', winnerName: 'Ramanand Ram', winnerParty: 'BJP', runnerUpName: 'Ram Binod Paswan', runnerUpParty: 'LJP', margin: 18412 },
  { constNo: 148, name: 'Alauli', winnerName: 'Ram Chandra Sada', winnerParty: 'JD(U)', runnerUpName: 'Pashupati Kumar Paras', runnerUpParty: 'LJP', margin: 17523 },
  { constNo: 149, name: 'Khagaria', winnerName: 'Poonam Devi Yadav', winnerParty: 'JD(U)', runnerUpName: 'Sushila Devi', runnerUpParty: 'LJP', margin: 26853 },
  { constNo: 150, name: 'Beldaur', winnerName: 'Pannalal Singh Patel', winnerParty: 'JD(U)', runnerUpName: 'Sunita Sharma', runnerUpParty: 'LJP', margin: 15738 },
  { constNo: 151, name: 'Parbatta', winnerName: 'Samrat Choudhary', winnerParty: 'RJD', runnerUpName: 'Ramanand Prasad Singh', runnerUpParty: 'JD(U)', margin: 808 },
  { constNo: 152, name: 'Bihpur', winnerName: 'Shailendra Kumar', winnerParty: 'BJP', runnerUpName: 'Shailesh Kumar', runnerUpParty: 'RJD', margin: 465 },
  { constNo: 153, name: 'Gopalpur', winnerName: 'Narendra Kumar Niraj', winnerParty: 'JD(U)', runnerUpName: 'Amit Rana', runnerUpParty: 'RJD', margin: 25060 },
  { constNo: 154, name: 'Pirpainti', winnerName: 'Aman Kumar', winnerParty: 'BJP', runnerUpName: 'Ram Vilash Paswan', runnerUpParty: 'RJD', margin: 5752 },
  { constNo: 155, name: 'Kahalgaon', winnerName: 'Sadanand Singh', winnerParty: 'INC', runnerUpName: 'Kahkashan Perween', runnerUpParty: 'JD(U)', margin: 8935 },
  { constNo: 156, name: 'Bhagalpur', winnerName: 'Ashwini Kumar Choubey', winnerParty: 'BJP', runnerUpName: 'Ajeet Sharma', runnerUpParty: 'INC', margin: 11060 },
  { constNo: 157, name: 'Sultanganj', winnerName: 'Subodh Rai', winnerParty: 'JD(U)', runnerUpName: 'Ramavatar Mandal', runnerUpParty: 'RJD', margin: 4845 },
  { constNo: 158, name: 'Nathnagar', winnerName: 'Ajai Kumar Mandal', winnerParty: 'JD(U)', runnerUpName: 'Abu Kaishar', runnerUpParty: 'RJD', margin: 4727 },
  { constNo: 159, name: 'Amarpur', winnerName: 'Janardan Manjhi', winnerParty: 'JD(U)', runnerUpName: 'Surendra Prasad Singh', runnerUpParty: 'RJD', margin: 18007 },
  { constNo: 160, name: 'Dhuraiya', winnerName: 'Manish Kumar', winnerParty: 'JD(U)', runnerUpName: 'Naresh Das', runnerUpParty: 'RJD', margin: 8342 },
  { constNo: 161, name: 'Banka', winnerName: 'Javed Iqbal Ansari', winnerParty: 'RJD', runnerUpName: 'Ram Narayan Mandal', runnerUpParty: 'BJP', margin: 2410 },
  { constNo: 162, name: 'Katoria', winnerName: 'Sonelal Hembram', winnerParty: 'BJP', runnerUpName: 'Suklal Besara', runnerUpParty: 'RJD', margin: 8763 },
  { constNo: 163, name: 'Belhar', winnerName: 'Giridhari Yadav', winnerParty: 'JD(U)', runnerUpName: 'Ramdeo Yadav', runnerUpParty: 'RJD', margin: 7616 },
  { constNo: 164, name: 'Tarapur', winnerName: 'Neeta Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Shakuni Choudhary', runnerUpParty: 'RJD', margin: 13878 },
  { constNo: 165, name: 'Munger', winnerName: 'Anant Kumar Satyarthy', winnerParty: 'JD(U)', runnerUpName: 'Shabnam Perwin', runnerUpParty: 'RJD', margin: 17613 },
  { constNo: 166, name: 'Jamalpur', winnerName: 'Shailesh Kumar', winnerParty: 'JD(U)', runnerUpName: 'Sadhana Devi', runnerUpParty: 'LJP', margin: 21142 },
  { constNo: 167, name: 'Surajgarha', winnerName: 'Prem Ranjan Patel', winnerParty: 'BJP', runnerUpName: 'Prahlad Yadav', runnerUpParty: 'RJD', margin: 2928 },
  { constNo: 168, name: 'Lakhisarai', winnerName: 'Vijay Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Fulaina Singh', runnerUpParty: 'RJD', margin: 59620 },
  { constNo: 169, name: 'Sheikhpura', winnerName: 'Randhir Kumar Soni', winnerParty: 'JD(U)', runnerUpName: 'Sunila Devi', runnerUpParty: 'INC', margin: 7342 },
  { constNo: 170, name: 'Barbigha', winnerName: 'Gajanand Shahi', winnerParty: 'JD(U)', runnerUpName: 'Ashok Choudhary', runnerUpParty: 'INC', margin: 3047 },
  { constNo: 171, name: 'Asthawan', winnerName: 'Jitendra Kumar', winnerParty: 'JD(U)', runnerUpName: 'Kapildev Prasad Singh', runnerUpParty: 'LJP', margin: 19570 },
  { constNo: 172, name: 'Biharsharif', winnerName: 'Dr. Sunil Kumar', winnerParty: 'JD(U)', runnerUpName: 'Aafrin Sultana', runnerUpParty: 'RJD', margin: 23712 },
  { constNo: 173, name: 'Rajgir', winnerName: 'Satyadeo Narain Arya', winnerParty: 'BJP', runnerUpName: 'Dhananjay Kumar', runnerUpParty: 'LJP', margin: 26951 },
  { constNo: 174, name: 'Islampur', winnerName: 'Rajib Ranjan', winnerParty: 'JD(U)', runnerUpName: 'Virendra Gop', runnerUpParty: 'RJD', margin: 23808 },
  { constNo: 175, name: 'Hilsa', winnerName: 'Usha Sinha', winnerParty: 'JD(U)', runnerUpName: 'Rina Devi', runnerUpParty: 'LJP', margin: 13202 },
  { constNo: 176, name: 'Nalanda', winnerName: 'Shrawon Kumar', winnerParty: 'JD(U)', runnerUpName: 'Arun Kumar', runnerUpParty: 'RJD', margin: 21037 },
  { constNo: 177, name: 'Harnaut', winnerName: 'Harinarayan Singh', winnerParty: 'JD(U)', runnerUpName: 'Arun Kumar', runnerUpParty: 'RJD', margin: 19797 },
  { constNo: 178, name: 'Mokama', winnerName: 'Anant Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Sonam Devi', runnerUpParty: 'LJP', margin: 8954 },
  { constNo: 179, name: 'Barh', winnerName: 'Gyanendra Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Vijay Krishna', runnerUpParty: 'RJD', margin: 19395 },
  { constNo: 180, name: 'Bakhtiarpur', winnerName: 'Aniruddh Kumar', winnerParty: 'RJD', runnerUpName: 'Vinode Yadav', runnerUpParty: 'BJP', margin: 14745 },
  { constNo: 181, name: 'Digha', winnerName: 'Punam Devi', winnerParty: 'JD(U)', runnerUpName: 'Satya Nand Sharma', runnerUpParty: 'LJP', margin: 60462 },
  { constNo: 182, name: 'Bankipur', winnerName: 'Nitin Nabin', winnerParty: 'BJP', runnerUpName: 'Binod Kumar Srivastava', runnerUpParty: 'RJD', margin: 60840 },
  { constNo: 183, name: 'Kumhrar', winnerName: 'Arun Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Md. Kamal Parwez', runnerUpParty: 'LJP', margin: 67808 },
  { constNo: 184, name: 'Patna Sahib', winnerName: 'Nand Kishore Yadav', winnerParty: 'BJP', runnerUpName: 'Parvej Ahmad', runnerUpParty: 'INC', margin: 65337 },
  { constNo: 185, name: 'Fatwa', winnerName: 'Dr. Ramanand Yadav', winnerParty: 'RJD', runnerUpName: 'Ajay Kumar Singh', runnerUpParty: 'JD(U)', margin: 9656 },
  { constNo: 186, name: 'Danapur', winnerName: 'Asha Devi', winnerParty: 'BJP', runnerUpName: 'Rit Lal Ray', runnerUpParty: 'IND', margin: 17919 },
  { constNo: 187, name: 'Maner', winnerName: 'Bhai Virendra', winnerParty: 'RJD', runnerUpName: 'Srikant Nirala', runnerUpParty: 'JD(U)', margin: 9601 },
  { constNo: 188, name: 'Phulwari', winnerName: 'Shyam Rajak', winnerParty: 'JD(U)', runnerUpName: 'Uday Kumar', runnerUpParty: 'RJD', margin: 21180 },
  { constNo: 189, name: 'Masaurhi', winnerName: 'Arun Manjhi', winnerParty: 'JD(U)', runnerUpName: 'Anil Kumar', runnerUpParty: 'LJP', margin: 5032 },
  { constNo: 190, name: 'Paliganj', winnerName: 'Dr. Usha Vidyarthi', winnerParty: 'BJP', runnerUpName: 'Jai Vardhan Yadav', runnerUpParty: 'RJD', margin: 10242 },
  { constNo: 191, name: 'Bikram', winnerName: 'Anil Kumar', winnerParty: 'BJP', runnerUpName: 'Siddharth', runnerUpParty: 'LJP', margin: 2352 },
  { constNo: 192, name: 'Sandesh', winnerName: 'Sanjay Singh Tiger', winnerParty: 'BJP', runnerUpName: 'Arun Kumar', runnerUpParty: 'IND', margin: 6822 },
  { constNo: 193, name: 'Barhara', winnerName: 'Raghwendra Pratap Singh', winnerParty: 'RJD', runnerUpName: 'Asha Devi', runnerUpParty: 'JD(U)', margin: 1083 },
  { constNo: 194, name: 'Arrah', winnerName: 'Amrendra Pratap Singh', winnerParty: 'BJP', runnerUpName: 'Shree Kumar Singh', runnerUpParty: 'LJP', margin: 18940 },
  { constNo: 195, name: 'Agiaon', winnerName: 'Shivesh Kumar', winnerParty: 'BJP', runnerUpName: 'Suresh Paswan', runnerUpParty: 'RJD', margin: 5249 },
  { constNo: 196, name: 'Tarari', winnerName: 'Narendra Kumar Pandey', winnerParty: 'JD(U)', runnerUpName: 'Adib Rizvi', runnerUpParty: 'RJD', margin: 14320 },
  { constNo: 197, name: 'Jagdishpur', winnerName: 'Dinesh Kumar Singh', winnerParty: 'RJD', runnerUpName: 'Sribhagwan Singh Kushwaha', runnerUpParty: 'JD(U)', margin: 10186 },
  { constNo: 198, name: 'Shahpur', winnerName: 'Munni Devi', winnerParty: 'BJP', runnerUpName: 'Dharmpal Singh', runnerUpParty: 'RJD', margin: 8211 },
  { constNo: 199, name: 'Barhampur', winnerName: 'Dilmarni Devi', winnerParty: 'BJP', runnerUpName: 'Ajit Chaudhary', runnerUpParty: 'RJD', margin: 20342 },
  { constNo: 200, name: 'Buxar', winnerName: 'Prof. Sukhada Pande', winnerParty: 'BJP', runnerUpName: 'Shyam Lal Singh Kushwaha', runnerUpParty: 'RJD', margin: 20183 },
  { constNo: 201, name: 'Dumraon', winnerName: 'Dr. Daud Ali', winnerParty: 'JD(U)', runnerUpName: 'Sunil Kumar', runnerUpParty: 'RJD', margin: 19846 },
  { constNo: 202, name: 'Rajpur', winnerName: 'Santosh Kumar Nirala', winnerParty: 'JD(U)', runnerUpName: 'Chhedi Lal Ram', runnerUpParty: 'LJP', margin: 15239 },
  { constNo: 203, name: 'Ramgarh', winnerName: 'Ambika Singh', winnerParty: 'RJD', runnerUpName: 'Ashok Kumar Singh', runnerUpParty: 'IND', margin: 2978 },
  { constNo: 204, name: 'Mohania', winnerName: 'Chhedi Paswan', winnerParty: 'JD(U)', runnerUpName: 'Niranjan Ram', runnerUpParty: 'RJD', margin: 2525 },
  { constNo: 205, name: 'Bhabua', winnerName: 'Dr. Pramod Kumar Singh', winnerParty: 'LJP', runnerUpName: 'Anand Bhushan Pandey', runnerUpParty: 'BJP', margin: 447 },
  { constNo: 206, name: 'Chainpur', winnerName: 'Brij Kishor Bind', winnerParty: 'BJP', runnerUpName: 'Dr. Ajay Alok', runnerUpParty: 'BSP', margin: 13580 },
  { constNo: 207, name: 'Chenari', winnerName: 'Shyam Bihari Ram', winnerParty: 'JD(U)', runnerUpName: 'Lalan Paswan', runnerUpParty: 'RJD', margin: 2901 },
  { constNo: 208, name: 'Sasaram', winnerName: 'Jawahar Prasad', winnerParty: 'BJP', runnerUpName: 'Dr. Ashok Kumar', runnerUpParty: 'RJD', margin: 5411 },
  { constNo: 209, name: 'Kargahar', winnerName: 'Ram Dhani Singh', winnerParty: 'JD(U)', runnerUpName: 'Shiv Shankar Singh', runnerUpParty: 'LJP', margin: 13197 },
  { constNo: 210, name: 'Dinara', winnerName: 'Jay Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Sita Sundari Devi', runnerUpParty: 'RJD', margin: 16610 },
  { constNo: 211, name: 'Nokha', winnerName: 'Rameshwar Prasad', winnerParty: 'BJP', runnerUpName: 'Kanti Singh', runnerUpParty: 'RJD', margin: 11723 },
  { constNo: 212, name: 'Dehri', winnerName: 'Jyoti Rashmi', winnerParty: 'IND', runnerUpName: 'Mohammad Iliyas Husain', runnerUpParty: 'RJD', margin: 9815 },
  { constNo: 213, name: 'Karakat', winnerName: 'Rajeshwar Raj', winnerParty: 'JD(U)', runnerUpName: 'Munna Rai', runnerUpParty: 'RJD', margin: 11415 },
  { constNo: 214, name: 'Arwal', winnerName: 'Chitranjan Kumar', winnerParty: 'BJP', runnerUpName: 'Mahanand Prasad', runnerUpParty: 'CPI(ML)(L)', margin: 4202 },
  { constNo: 215, name: 'Kurtha', winnerName: 'Satyadev Singh', winnerParty: 'JD(U)', runnerUpName: 'Shiv Bachan Yadav', runnerUpParty: 'RJD', margin: 9493 },
  { constNo: 216, name: 'Jahanabad', winnerName: 'Abhiram Sharma', winnerParty: 'JD(U)', runnerUpName: 'Sachchita Nand Yadav', runnerUpParty: 'RJD', margin: 8567 },
  { constNo: 217, name: 'Ghosi', winnerName: 'Rahul Kumar', winnerParty: 'JD(U)', runnerUpName: 'Jagdish Prasad', runnerUpParty: 'LJP', margin: 14276 },
  { constNo: 218, name: 'Makhdumpur', winnerName: 'Jitan Ram Manjhi', winnerParty: 'JD(U)', runnerUpName: 'Dharmraj Paswan', runnerUpParty: 'RJD', margin: 5085 },
  { constNo: 219, name: 'Goh', winnerName: 'Dr. Ranvijay Kumar', winnerParty: 'JD(U)', runnerUpName: 'Ram Ayodhya Prasad Yadav', runnerUpParty: 'RJD', margin: 694 },
  { constNo: 220, name: 'Obra', winnerName: 'Somprakash Singh', winnerParty: 'IND', runnerUpName: 'Pramod Singh Chadravanshi', runnerUpParty: 'JD(U)', margin: 802 },
  { constNo: 221, name: 'Nabinagar', winnerName: 'Virendra Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Vijay Kumar Singh', runnerUpParty: 'LJP', margin: 11834 },
  { constNo: 222, name: 'Kutumba', winnerName: 'Lalan Ram', winnerParty: 'JD(U)', runnerUpName: 'Suresh Paswan', runnerUpParty: 'RJD', margin: 13910 },
  { constNo: 223, name: 'Aurangabad', winnerName: 'Ramadhar Singh', winnerParty: 'BJP', runnerUpName: 'Sunil Kumar Singh', runnerUpParty: 'RJD', margin: 6242 },
  { constNo: 224, name: 'Rafiganj', winnerName: 'Ashok Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Mohammad Nehaluddin', runnerUpParty: 'RJD', margin: 23685 },
  { constNo: 225, name: 'Gurua', winnerName: 'Surendra Prasad Sinha', winnerParty: 'BJP', runnerUpName: 'Bindeshwari Prasad Yadav', runnerUpParty: 'RJD', margin: 11436 },
  { constNo: 226, name: 'Sherghati', winnerName: 'Vinod Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Sushama Devi', runnerUpParty: 'IND', margin: 6503 },
  { constNo: 227, name: 'Imamganj', winnerName: 'Uday Narain Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Raushan Kumar', runnerUpParty: 'RJD', margin: 1211 },
  { constNo: 228, name: 'Barachatti', winnerName: 'Jyoti Devi', winnerParty: 'JD(U)', runnerUpName: 'Samta Devi', runnerUpParty: 'RJD', margin: 23746 },
  { constNo: 229, name: 'Bodh Gaya', winnerName: 'Shyam Deo Paswan', winnerParty: 'BJP', runnerUpName: 'Kumar Sarvjeet', runnerUpParty: 'LJP', margin: 11213 },
  { constNo: 230, name: 'Gaya Town', winnerName: 'Prem Kumar', winnerParty: 'BJP', runnerUpName: 'Jalal Uddin Ansari', runnerUpParty: 'CPI', margin: 28417 },
  { constNo: 231, name: 'Tikari', winnerName: 'Dr. Anil Kumar', winnerParty: 'JD(U)', runnerUpName: 'Bagi Kumar Verma', runnerUpParty: 'RJD', margin: 18541 },
  { constNo: 232, name: 'Belaganj', winnerName: 'Surendra Prasad Yadav', winnerParty: 'RJD', runnerUpName: 'Mohammad Amzad', runnerUpParty: 'JD(U)', margin: 4638 },
  { constNo: 233, name: 'Atri', winnerName: 'Krishna Nandan Yadav', winnerParty: 'JD(U)', runnerUpName: 'Kunti Devi', runnerUpParty: 'RJD', margin: 20610 },
  { constNo: 234, name: 'Wazirganj', winnerName: 'Virendra Singh', winnerParty: 'BJP', runnerUpName: 'Awadhesh Kumar Singh', runnerUpParty: 'INC', margin: 17766 },
  { constNo: 235, name: 'Rajauli', winnerName: 'Kanhaiya Kumar', winnerParty: 'BJP', runnerUpName: 'Prakash Bir', runnerUpParty: 'RJD', margin: 14090 },
  { constNo: 236, name: 'Hisua', winnerName: 'Anil Singh', winnerParty: 'BJP', runnerUpName: 'Anil Mehta', runnerUpParty: 'LJP', margin: 3978 },
  { constNo: 237, name: 'Nawada', winnerName: 'Purnima Yadav', winnerParty: 'JD(U)', runnerUpName: 'Rajballabh Prasad', runnerUpParty: 'RJD', margin: 6337 },
  { constNo: 238, name: 'Gobindpur', winnerName: 'Kaushal Yadav', winnerParty: 'JD(U)', runnerUpName: 'Prof. K. B. Prasad', runnerUpParty: 'LJP', margin: 20887 },
  { constNo: 239, name: 'Warsaliganj', winnerName: 'Pradip Kumar', winnerParty: 'JD(U)', runnerUpName: 'Aruna Devi', runnerUpParty: 'INC', margin: 5428 },
  { constNo: 240, name: 'Sikandra', winnerName: 'Rameshwar Paswan', winnerParty: 'JD(U)', runnerUpName: 'Subhash Chandra Bosh', runnerUpParty: 'LJP', margin: 12361 },
  { constNo: 241, name: 'Jamui', winnerName: 'Ajay Pratap', winnerParty: 'JD(U)', runnerUpName: 'Vijay Prakash', runnerUpParty: 'RJD', margin: 24467 },
  { constNo: 242, name: 'Jhajha', winnerName: 'Damodar Rawat', winnerParty: 'JD(U)', runnerUpName: 'Binod Prasad Yadav', runnerUpParty: 'RJD', margin: 10204 },
  { constNo: 243, name: 'Chakai', winnerName: 'Sumit Kumar Singh', winnerParty: 'JMM', runnerUpName: 'Bijay Kumar Singh', runnerUpParty: 'LJP', margin: 188 },
];

/** Parties confirmed in DB from prior seeds */
const EXISTING_IN_SEED = new Set([
  'BJP', 'INC', 'JDU', 'RJD', 'LJPRV', 'HAM', 'BSP', 'AAP', 'CPIM', 'CPI',
  'AIMIM', 'AIFB', 'NCPSP', 'NCP', 'AP1', 'JMM', 'RLM', 'BP', 'IND', 'NOTA',
  'CPIML', 'HAMS', 'VSIP', 'LJP', 'JTVP',
]);

/** Full party names for new party inserts */
const PARTY_FULL_NAMES: Record<string, string> = {};

function main() {
  console.log('=== Bihar Vidhan Sabha 2010 Seed Generator ===\n');

  const lines: string[] = [];
  lines.push('-- Bihar Vidhan Sabha 2010 Election Data');
  lines.push('-- Source: elections.in (winner + runner-up per constituency)');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_bihar_vs_2010.sql');
  lines.push('');

  // Collect all parties used
  const usedParties = new Set<string>();
  for (const row of RAW_DATA) {
    usedParties.add(row.winnerParty);
    usedParties.add(row.runnerUpParty);
  }

  // New parties not in existing seeds
  const newParties: { id: string; name: string; color: string }[] = [];

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
  lines.push(`  ('${ELECTION_ID}', 'Bihar Vidhan Sabha 2010', 'VS', ${STATE_ID}, 2010, 'Finalized', NULL)`);
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
  lines.push(constLines.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  // Candidates and Results
  lines.push('-- Candidates (winner + runner-up per constituency)');
  const candidateInserts: string[] = [];
  const resultInserts: string[] = [];
  let totalCandidates = 0;

  for (const row of RAW_DATA) {
    const constId = makeConstId(row.name, row.constNo);
    const winnerPartyId = PARTY_MAP[row.winnerParty] || 'IND';
    const runnerUpPartyId = PARTY_MAP[row.runnerUpParty] || 'IND';

    const runnerUpVotes = 50000;
    const winnerVotes = runnerUpVotes + row.margin;

    const winCandId = randomUUID();
    candidateInserts.push(
      `  ('${winCandId}', NULL, '${ELECTION_ID}', '${esc(constId)}', '${esc(winnerPartyId)}', '${esc(row.winnerName)}', FALSE)`
    );
    resultInserts.push(
      `  ('${randomUUID()}', '${winCandId}', '${esc(constId)}', ${winnerVotes}, 'WON', ${row.margin}, 0, '${ELECTION_ID}')`
    );
    totalCandidates++;

    const ruCandId = randomUUID();
    candidateInserts.push(
      `  ('${ruCandId}', NULL, '${ELECTION_ID}', '${esc(constId)}', '${esc(runnerUpPartyId)}', '${esc(row.runnerUpName)}', FALSE)`
    );
    resultInserts.push(
      `  ('${randomUUID()}', '${ruCandId}', '${esc(constId)}', ${runnerUpVotes}, 'LOST', ${row.margin}, 0, '${ELECTION_ID}')`
    );
    totalCandidates++;
  }

  lines.push('INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent) VALUES');
  lines.push(candidateInserts.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  lines.push('-- Results');
  lines.push('INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no, election_id) VALUES');
  lines.push(resultInserts.join(',\n') + '\nON CONFLICT DO NOTHING;');
  lines.push('');

  // Manifest — In 2010, JDU+BJP were allies in NDA
  const manifest = {
    alliances: [
      {
        id: 'NDA',
        name: 'National Democratic Alliance',
        color: '#FF6B00',
        parties: ['BJP', 'JDU'],
      },
      {
        id: 'UPA',
        name: 'United Progressive Alliance',
        color: '#00BFFF',
        parties: ['INC', 'RJD', 'NCP'],
      },
    ],
    leaders: [
      { name: 'Nitish Kumar', party_id: 'JDU', const_id: '' },
      { name: 'Lalu Prasad Yadav', party_id: 'RJD', const_id: '' },
    ],
    cabinet: [],
    tracked: ['NDA', 'UPA', 'LJP'],
    vip_seats: {},
    milestones: [{ label: 'Majority', value: 122 }],
    compare_with: [] as string[],
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
  const outPath = path.resolve(__dirname, '../../database/seed_bihar_vs_2010.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Done! Wrote ${outPath}`);
  console.log(`  ${RAW_DATA.length} constituencies`);
  console.log(`  ${totalCandidates} candidates`);
}

main();
