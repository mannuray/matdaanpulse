/**
 * Generate Bihar Vidhan Sabha 2015 seed SQL from hardcoded scraped data.
 *
 * Usage: npx ts-node src/generate-bihar-vs-2015-seed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const ELECTION_ID = 'a1b2c3d4-e5f6-7890-abcd-111111111015';
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
  'HAM(S)': 'HAMS',
  'LJP': 'LJP',
  'AIMIM': 'AIMIM',
  'BSP': 'BSP',
  'RLSP': 'RLSP',
  'NCP': 'NCP',
  'IND': 'IND',
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
  HAMS: '#228B22',
  LJP: '#0000CD',
  AIMIM: '#008000',
  BSP: '#0033CC',
  RLSP: '#FF8C00',
  NCP: '#004953',
  IND: '#808080',
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** Build constituency ID for 2015: BR_VS15_{constNo}_{NAME} */
function makeConstId(name: string, constNo: number): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `BR_VS15_${constNo}_${clean}`;
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

/** All 243 constituencies from Bihar 2015 election (scraped from elections.in) */
const RAW_DATA: RawRow[] = [
  { constNo: 1, name: 'Valmiki Nagar', winnerName: 'Dhirendra Pratap Singh', winnerParty: 'IND', runnerUpName: 'Irshad Hussain', runnerUpParty: 'INC', margin: 33580 },
  { constNo: 2, name: 'Ramnagar', winnerName: 'Bhagirathi Devi', winnerParty: 'BJP', runnerUpName: 'Purnmasi Ram', runnerUpParty: 'INC', margin: 17988 },
  { constNo: 3, name: 'Narkatiaganj', winnerName: 'Vinay Varma', winnerParty: 'INC', runnerUpName: 'Renu Devi', runnerUpParty: 'BJP', margin: 16061 },
  { constNo: 4, name: 'Bagaha', winnerName: 'Raghaw Sharan Pandey', winnerParty: 'BJP', runnerUpName: 'Bhishm Sahani', runnerUpParty: 'JD(U)', margin: 8183 },
  { constNo: 5, name: 'Lauriya', winnerName: 'Vinay Bihari', winnerParty: 'BJP', runnerUpName: 'Ran Kaushal Pratap Singh', runnerUpParty: 'RJD', margin: 17573 },
  { constNo: 6, name: 'Nautan', winnerName: 'Narayan Prasad', winnerParty: 'BJP', runnerUpName: 'Baidyanath Prasad Mahto', runnerUpParty: 'JD(U)', margin: 14335 },
  { constNo: 7, name: 'Chanpatia', winnerName: 'Prakash Rai', winnerParty: 'BJP', runnerUpName: 'N. N. Sahi', runnerUpParty: 'JD(U)', margin: 464 },
  { constNo: 8, name: 'Bettiah', winnerName: 'Madan Mohan Tiwari', winnerParty: 'INC', runnerUpName: 'Renu Devi', runnerUpParty: 'BJP', margin: 2320 },
  { constNo: 9, name: 'Sikta', winnerName: 'Khurshid Urf Firoj Ahmad', winnerParty: 'JD(U)', runnerUpName: 'Dilip Varma', runnerUpParty: 'BJP', margin: 2835 },
  { constNo: 10, name: 'Raxaul', winnerName: 'Ajay Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Suresh Kumar', runnerUpParty: 'RJD', margin: 3169 },
  { constNo: 11, name: 'Sugauli', winnerName: 'Ramchandra Sahni', winnerParty: 'BJP', runnerUpName: 'Om Prakash Choudhary', runnerUpParty: 'RJD', margin: 7756 },
  { constNo: 12, name: 'Narkatia', winnerName: 'Shamim Ahmad', winnerParty: 'RJD', runnerUpName: 'Sant Singh Kushwaha', runnerUpParty: 'RLSP', margin: 19982 },
  { constNo: 13, name: 'Harsidhi', winnerName: 'Rajendra Kumar', winnerParty: 'RJD', runnerUpName: 'Krishnandan Paswan', runnerUpParty: 'BJP', margin: 10267 },
  { constNo: 14, name: 'Govindganj', winnerName: 'Raju Tiwari', winnerParty: 'LJP', runnerUpName: 'Brajesh Kumar', runnerUpParty: 'INC', margin: 27920 },
  { constNo: 15, name: 'Kesariya', winnerName: 'Dr. Rajesh Kumar', winnerParty: 'RJD', runnerUpName: 'Rajendra Prasad Gupta', runnerUpParty: 'BJP', margin: 15947 },
  { constNo: 16, name: 'Kalyanpur', winnerName: 'Sachindra Prasad Singh', winnerParty: 'BJP', runnerUpName: 'Razia Khatoon', runnerUpParty: 'JD(U)', margin: 11488 },
  { constNo: 17, name: 'Pipra', winnerName: 'Shyambabu Prasad Yadav', winnerParty: 'BJP', runnerUpName: 'Krishan Chandra', runnerUpParty: 'JD(U)', margin: 3930 },
  { constNo: 18, name: 'Madhuban', winnerName: 'Rana Randhir', winnerParty: 'BJP', runnerUpName: 'Shivajee Rai', runnerUpParty: 'JD(U)', margin: 16222 },
  { constNo: 19, name: 'Motihari', winnerName: 'Pramod Kumar', winnerParty: 'BJP', runnerUpName: 'Binod Kumar Shrivastava', runnerUpParty: 'RJD', margin: 18517 },
  { constNo: 20, name: 'Chiraia', winnerName: 'Lal Babu Prasad Gupta', winnerParty: 'BJP', runnerUpName: 'Laxmi Narayan Prasad Yadav', runnerUpParty: 'RJD', margin: 4374 },
  { constNo: 21, name: 'Dhaka', winnerName: 'Faisal Rahman', winnerParty: 'RJD', runnerUpName: 'Pawan Kumar Jaiswal', runnerUpParty: 'BJP', margin: 19197 },
  { constNo: 22, name: 'Sheohar', winnerName: 'Sharfuddin', winnerParty: 'JD(U)', runnerUpName: 'Labhali Anand', runnerUpParty: 'HAM(S)', margin: 461 },
  { constNo: 23, name: 'Riga', winnerName: 'Amit Kumar', winnerParty: 'INC', runnerUpName: 'Moti Lal Prasad', runnerUpParty: 'BJP', margin: 22856 },
  { constNo: 24, name: 'Bathnaha', winnerName: 'Dinkar Ram', winnerParty: 'BJP', runnerUpName: 'Surendra Ram', runnerUpParty: 'INC', margin: 20166 },
  { constNo: 25, name: 'Parihar', winnerName: 'Gaytri Devi', winnerParty: 'BJP', runnerUpName: 'Ram Kaushal Pratap Singh', runnerUpParty: 'RJD', margin: 4017 },
  { constNo: 26, name: 'Sursand', winnerName: 'Syed Abu Dojana', winnerParty: 'RJD', runnerUpName: 'Amit Kumar', runnerUpParty: 'IND', margin: 23234 },
  { constNo: 27, name: 'Bajpatti', winnerName: 'Dr. Ranju Geeta', winnerParty: 'JD(U)', runnerUpName: 'Rekha Kumari', runnerUpParty: 'RLSP', margin: 16946 },
  { constNo: 28, name: 'Sitamarhi', winnerName: 'Sunil Kumar', winnerParty: 'RJD', runnerUpName: 'Sunil Kumar Alias Pintu', runnerUpParty: 'BJP', margin: 14722 },
  { constNo: 29, name: 'Runisaidpur', winnerName: 'Mangita Devi', winnerParty: 'RJD', runnerUpName: 'Pankaj Kumar Mishra', runnerUpParty: 'RLSP', margin: 14110 },
  { constNo: 30, name: 'Belsand', winnerName: 'Sunita Singh Chauhan', winnerParty: 'JD(U)', runnerUpName: 'Md. Nasir Ahamad', runnerUpParty: 'LJP', margin: 5575 },
  { constNo: 31, name: 'Harlakhi', winnerName: 'Basant Kumar', winnerParty: 'RLSP', runnerUpName: 'Mohammad Shabbir', runnerUpParty: 'INC', margin: 3892 },
  { constNo: 32, name: 'Benipatti', winnerName: 'Bhawana Jha', winnerParty: 'INC', runnerUpName: 'Vinod Narain Jha', runnerUpParty: 'BJP', margin: 4734 },
  { constNo: 33, name: 'Khajauli', winnerName: 'Sitaram Yadav', winnerParty: 'RJD', runnerUpName: 'Arun Shankar Prasad', runnerUpParty: 'BJP', margin: 10703 },
  { constNo: 34, name: 'Babubarhi', winnerName: 'Kapil Deo Kamat', winnerParty: 'JD(U)', runnerUpName: 'Binod Kumar Singh', runnerUpParty: 'LJP', margin: 20267 },
  { constNo: 35, name: 'Bisfi', winnerName: 'Faiyaz Ahmad', winnerParty: 'RJD', runnerUpName: 'Manoj Kumar Yadav', runnerUpParty: 'RLSP', margin: 35325 },
  { constNo: 36, name: 'Madhubani', winnerName: 'Samir Kumar Mahaseth', winnerParty: 'RJD', runnerUpName: 'Ramdeo Mahto', runnerUpParty: 'BJP', margin: 7307 },
  { constNo: 37, name: 'Rajnagar', winnerName: 'Ram Prit Paswan', winnerParty: 'BJP', runnerUpName: 'Ramawatar Paswan', runnerUpParty: 'RJD', margin: 6242 },
  { constNo: 38, name: 'Jhanjharpur', winnerName: 'Gulab Yadav', winnerParty: 'RJD', runnerUpName: 'Nitish Mishra', runnerUpParty: 'BJP', margin: 834 },
  { constNo: 39, name: 'Phulparas', winnerName: 'Guljar Devi', winnerParty: 'JD(U)', runnerUpName: 'Ram Sundar Yadav', runnerUpParty: 'BJP', margin: 13415 },
  { constNo: 40, name: 'Laukaha', winnerName: 'Lakshmeshwar Roy', winnerParty: 'JD(U)', runnerUpName: 'Pramod Kumar Priyedarshi', runnerUpParty: 'BJP', margin: 23833 },
  { constNo: 41, name: 'Nirmali', winnerName: 'Anirudh Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Ram Kumar Roy', runnerUpParty: 'BJP', margin: 23951 },
  { constNo: 42, name: 'Pipra', winnerName: 'Yadubansh Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Vishwamohan Kumar', runnerUpParty: 'BJP', margin: 36369 },
  { constNo: 43, name: 'Supaul', winnerName: 'Bijendra Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Kishor Kumar', runnerUpParty: 'BJP', margin: 37397 },
  { constNo: 44, name: 'Tribeniganj', winnerName: 'Veena Bharti', winnerParty: 'JD(U)', runnerUpName: 'Anant Kumar Bharti', runnerUpParty: 'LJP', margin: 52400 },
  { constNo: 45, name: 'Chhatapur', winnerName: 'Niraj Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Jahur Alam', runnerUpParty: 'RJD', margin: 9292 },
  { constNo: 46, name: 'Narpatganj', winnerName: 'Anil Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Janardan Yadav', runnerUpParty: 'BJP', margin: 25951 },
  { constNo: 47, name: 'Raniganj', winnerName: 'Achmit Rishidev', winnerParty: 'JD(U)', runnerUpName: 'Ramji Das Rishidev', runnerUpParty: 'BJP', margin: 14930 },
  { constNo: 48, name: 'Forbesganj', winnerName: 'Vidya Sagar Keshri', winnerParty: 'BJP', runnerUpName: 'Krityanand Biswas', runnerUpParty: 'RJD', margin: 25238 },
  { constNo: 49, name: 'Araria', winnerName: 'Avidur Rahman', winnerParty: 'INC', runnerUpName: 'Ajay Kumar Jha', runnerUpParty: 'LJP', margin: 40044 },
  { constNo: 50, name: 'Jokihat', winnerName: 'Sarfraz Alam', winnerParty: 'JD(U)', runnerUpName: 'Ranjeet Yadav', runnerUpParty: 'IND', margin: 53980 },
  { constNo: 51, name: 'Sikti', winnerName: 'Vijay Kumar Mandal', winnerParty: 'BJP', runnerUpName: 'Shatrughan Prasad Suman', runnerUpParty: 'JD(U)', margin: 8106 },
  { constNo: 52, name: 'Bahadurganj', winnerName: 'M.D. Tauseef Alam', winnerParty: 'INC', runnerUpName: 'Awadh Bihari Singh', runnerUpParty: 'BJP', margin: 13942 },
  { constNo: 53, name: 'Thakurganj', winnerName: 'Naushad Alam', winnerParty: 'JD(U)', runnerUpName: 'Gopal Kumar Agrawal', runnerUpParty: 'LJP', margin: 8087 },
  { constNo: 54, name: 'Kishanganj', winnerName: 'Dr Mohammad Jawaid', winnerParty: 'INC', runnerUpName: 'Sweety Singh', runnerUpParty: 'BJP', margin: 8609 },
  { constNo: 55, name: 'Kochadhaman', winnerName: 'Mujahid Alam', winnerParty: 'JD(U)', runnerUpName: 'Akhtarul Iman', runnerUpParty: 'AIMIM', margin: 18843 },
  { constNo: 56, name: 'Amour', winnerName: 'Abdul Jalil Mastan', winnerParty: 'INC', runnerUpName: 'Saba Zafar', runnerUpParty: 'BJP', margin: 51997 },
  { constNo: 57, name: 'Baisi', winnerName: 'Abdus Subhan', winnerParty: 'RJD', runnerUpName: 'Binod Kumar', runnerUpParty: 'IND', margin: 38740 },
  { constNo: 58, name: 'Kasba', winnerName: 'Md. Afaque Alam', winnerParty: 'INC', runnerUpName: 'Pradip Kumar Das', runnerUpParty: 'BJP', margin: 1794 },
  { constNo: 59, name: 'Banmankhi', winnerName: 'Krishna Kumar Rishi', winnerParty: 'BJP', runnerUpName: 'Sanjiv Kumar Paswan', runnerUpParty: 'RJD', margin: 708 },
  { constNo: 60, name: 'Rupauli', winnerName: 'Bima Bharti', winnerParty: 'JD(U)', runnerUpName: 'Prem Prakash Mandal', runnerUpParty: 'BJP', margin: 9672 },
  { constNo: 61, name: 'Dhamdaha', winnerName: 'Leshi Singh', winnerParty: 'JD(U)', runnerUpName: 'Shiv Shankar Thakur', runnerUpParty: 'RLSP', margin: 29817 },
  { constNo: 62, name: 'Purnia', winnerName: 'Vijay Kumar Khemka', winnerParty: 'BJP', runnerUpName: 'Indu Sinha', runnerUpParty: 'INC', margin: 32815 },
  { constNo: 63, name: 'Katihar', winnerName: 'Tarkishore Prasad', winnerParty: 'BJP', runnerUpName: 'Bijay Singh', runnerUpParty: 'JD(U)', margin: 14894 },
  { constNo: 64, name: 'Kadwa', winnerName: 'Shakeel Ahmad Khan', winnerParty: 'INC', runnerUpName: 'Chander Bhushan Thakur', runnerUpParty: 'BJP', margin: 5799 },
  { constNo: 65, name: 'Balrampur', winnerName: 'Mahboob Alam', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Barun Kumar Jha', runnerUpParty: 'BJP', margin: 20419 },
  { constNo: 66, name: 'Pranpur', winnerName: 'Binod Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Israt Parween', runnerUpParty: 'NCP', margin: 8101 },
  { constNo: 67, name: 'Manihari', winnerName: 'Manohar Prasad Singh', winnerParty: 'INC', runnerUpName: 'Anil Kumar Oraon', runnerUpParty: 'LJP', margin: 13680 },
  { constNo: 68, name: 'Barari', winnerName: 'Neeraj Kumar', winnerParty: 'RJD', runnerUpName: 'Bibhash Chandra Choudhary', runnerUpParty: 'BJP', margin: 14336 },
  { constNo: 69, name: 'Korha', winnerName: 'Punam Kumari', winnerParty: 'INC', runnerUpName: 'Mahesh Paswan', runnerUpParty: 'BJP', margin: 5426 },
  { constNo: 70, name: 'Alamnagar', winnerName: 'Narendra Narayan Yadav', winnerParty: 'JD(U)', runnerUpName: 'Chandan Singh', runnerUpParty: 'LJP', margin: 43876 },
  { constNo: 71, name: 'Bihariganj', winnerName: 'Niranjan Kumar Mehta', winnerParty: 'JD(U)', runnerUpName: 'Ravindra Charan Yadav', runnerUpParty: 'BJP', margin: 29253 },
  { constNo: 72, name: 'Singheshwar', winnerName: 'Ramesh Rishidev', winnerParty: 'JD(U)', runnerUpName: 'Manju Devi', runnerUpParty: 'HAM(S)', margin: 50200 },
  { constNo: 73, name: 'Madhepura', winnerName: 'Chandra Shekhar', winnerParty: 'RJD', runnerUpName: 'Vijay Kumar Bimal', runnerUpParty: 'BJP', margin: 37642 },
  { constNo: 74, name: 'Sonbarsa', winnerName: 'Ratnesh Sada', winnerParty: 'JD(U)', runnerUpName: 'Sarita Devi', runnerUpParty: 'LJP', margin: 53763 },
  { constNo: 75, name: 'Saharsa', winnerName: 'Arun Kumar', winnerParty: 'RJD', runnerUpName: 'Alok Ranjan', runnerUpParty: 'BJP', margin: 39206 },
  { constNo: 76, name: 'Simri Bakhtiarpur', winnerName: 'Dinesh Chandra Yadav', winnerParty: 'JD(U)', runnerUpName: 'Yusuf Salahuddin', runnerUpParty: 'LJP', margin: 37806 },
  { constNo: 77, name: 'Mahishi', winnerName: 'Dr. Abdul Ghafoor', winnerParty: 'RJD', runnerUpName: 'Chandan Kumar Sah', runnerUpParty: 'RLSP', margin: 26135 },
  { constNo: 78, name: 'Kusheshwarasthan', winnerName: 'Shashi Bhusan Hazari', winnerParty: 'JD(U)', runnerUpName: 'Dhananjay Kumar', runnerUpParty: 'LJP', margin: 19850 },
  { constNo: 79, name: 'Gora Bauram', winnerName: 'Madan Sahni', winnerParty: 'JD(U)', runnerUpName: 'Vinod Sahni', runnerUpParty: 'LJP', margin: 14062 },
  { constNo: 80, name: 'Benipur', winnerName: 'Sunil Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Gopal Jee Thakur', runnerUpParty: 'BJP', margin: 26443 },
  { constNo: 81, name: 'Alinagar', winnerName: 'Abdul Bari Siddiqui', winnerParty: 'RJD', runnerUpName: 'Mishri Lal Yadav', runnerUpParty: 'BJP', margin: 13460 },
  { constNo: 82, name: 'Darbhanga Rural', winnerName: 'Lalit Kumar Yadav', winnerParty: 'RJD', runnerUpName: 'Naushad Ahmad', runnerUpParty: 'HAM(S)', margin: 34491 },
  { constNo: 83, name: 'Darbhanga', winnerName: 'Sanjay Saraogi', winnerParty: 'BJP', runnerUpName: 'Om Prakash Kheria', runnerUpParty: 'RJD', margin: 7460 },
  { constNo: 84, name: 'Hayaghat', winnerName: 'Amar Nath Gami', winnerParty: 'JD(U)', runnerUpName: 'Ramesh Choudhary', runnerUpParty: 'LJP', margin: 33231 },
  { constNo: 85, name: 'Bahadurpur', winnerName: 'Bhola Yadav', winnerParty: 'RJD', runnerUpName: 'Hari Sahani', runnerUpParty: 'BJP', margin: 16989 },
  { constNo: 86, name: 'Keoti', winnerName: 'Faraz Fatmi', winnerParty: 'RJD', runnerUpName: 'Ashok Kumar Yadav', runnerUpParty: 'BJP', margin: 7830 },
  { constNo: 87, name: 'Jale', winnerName: 'Jibesh Kumar', winnerParty: 'BJP', runnerUpName: 'Rishi Mishra', runnerUpParty: 'JD(U)', margin: 4620 },
  { constNo: 88, name: 'Gaighat', winnerName: 'Maheshwar Prasad Yadav', winnerParty: 'RJD', runnerUpName: 'Veena Devi', runnerUpParty: 'BJP', margin: 3501 },
  { constNo: 89, name: 'Aurai', winnerName: 'Surendra Kumar', winnerParty: 'RJD', runnerUpName: 'Ram Surat Ray', runnerUpParty: 'BJP', margin: 10825 },
  { constNo: 90, name: 'Minapur', winnerName: 'Rajeev Kumar Urf Munna Yadav', winnerParty: 'RJD', runnerUpName: 'Ajay Kumar', runnerUpParty: 'BJP', margin: 23940 },
  { constNo: 91, name: 'Bochaha', winnerName: 'Beby Kumari', winnerParty: 'IND', runnerUpName: 'Ramai Ram', runnerUpParty: 'JD(U)', margin: 24130 },
  { constNo: 92, name: 'Sakra', winnerName: 'Lal Babu Ram', winnerParty: 'RJD', runnerUpName: 'Arjun Ram', runnerUpParty: 'BJP', margin: 13012 },
  { constNo: 93, name: 'Kurhani', winnerName: 'Kedar Prasad Gupta', winnerParty: 'BJP', runnerUpName: 'Manoj Kumar Singh', runnerUpParty: 'JD(U)', margin: 11570 },
  { constNo: 94, name: 'Muzaffarpur', winnerName: 'Suresh Kumar Sharma', winnerParty: 'BJP', runnerUpName: 'Bijendra Chaudhary', runnerUpParty: 'JD(U)', margin: 29739 },
  { constNo: 95, name: 'Kanti', winnerName: 'Ashok Kumar Choudhary', winnerParty: 'IND', runnerUpName: 'Ajit Kumar', runnerUpParty: 'HAM(S)', margin: 9275 },
  { constNo: 96, name: 'Baruraj', winnerName: 'Nand Kumar Rai', winnerParty: 'RJD', runnerUpName: 'Arun Kumar Singh', runnerUpParty: 'BJP', margin: 4909 },
  { constNo: 97, name: 'Paroo', winnerName: 'Ashok Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Shankar Prasad', runnerUpParty: 'RJD', margin: 13539 },
  { constNo: 98, name: 'Sahebganj', winnerName: 'Ramvichar Rai', winnerParty: 'RJD', runnerUpName: 'Raju Kumar Singh', runnerUpParty: 'BJP', margin: 10660 },
  { constNo: 99, name: 'Baikunthpur', winnerName: 'Mithilesh Tiwari', winnerParty: 'BJP', runnerUpName: 'Manjeet Kumar Singh', runnerUpParty: 'JD(U)', margin: 14115 },
  { constNo: 100, name: 'Barauli', winnerName: 'Md Nematullah', winnerParty: 'RJD', runnerUpName: 'Rampravesh Rai', runnerUpParty: 'BJP', margin: 504 },
  { constNo: 101, name: 'Gopalganj', winnerName: 'Subash Singh', winnerParty: 'BJP', runnerUpName: 'Reyajul Haque', runnerUpParty: 'RJD', margin: 5074 },
  { constNo: 102, name: 'Kuchaikote', winnerName: 'Amrendra Kumar Pandey', winnerParty: 'JD(U)', runnerUpName: 'Kali Prasad Pandey', runnerUpParty: 'LJP', margin: 3562 },
  { constNo: 103, name: 'Bhore', winnerName: 'Anil Kumar', winnerParty: 'INC', runnerUpName: 'Indradev Manjhi', runnerUpParty: 'BJP', margin: 14871 },
  { constNo: 104, name: 'Hathua', winnerName: 'Ramsewak Singh', winnerParty: 'JD(U)', runnerUpName: 'Mahachandra Pd. Singh', runnerUpParty: 'HAM(S)', margin: 22984 },
  { constNo: 105, name: 'Siwan', winnerName: 'Vyas Deo Prasad', winnerParty: 'BJP', runnerUpName: 'Bablu Prasad', runnerUpParty: 'JD(U)', margin: 3534 },
  { constNo: 106, name: 'Ziradei', winnerName: 'Ramesh Singh Kushwaha', winnerParty: 'JD(U)', runnerUpName: 'Asha Devi', runnerUpParty: 'BJP', margin: 6091 },
  { constNo: 107, name: 'Darauli', winnerName: 'Satyadeo Ram', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Ramayan Manjhi', runnerUpParty: 'BJP', margin: 9584 },
  { constNo: 108, name: 'Raghunathpur', winnerName: 'Harishankar Yadav', winnerParty: 'RJD', runnerUpName: 'Manoj Kumar Singh', runnerUpParty: 'BJP', margin: 10622 },
  { constNo: 109, name: 'Daraundha', winnerName: 'Kavita Singh', winnerParty: 'JD(U)', runnerUpName: 'Jitendra Swami', runnerUpParty: 'BJP', margin: 13222 },
  { constNo: 110, name: 'Barharia', winnerName: 'Shyam Bahadur Singh', winnerParty: 'JD(U)', runnerUpName: 'Bachha Panday', runnerUpParty: 'LJP', margin: 14583 },
  { constNo: 111, name: 'Goriyakothi', winnerName: 'Satyadeo Prasad Singh', winnerParty: 'RJD', runnerUpName: 'Devesh Kant Singh', runnerUpParty: 'BJP', margin: 7651 },
  { constNo: 112, name: 'Maharajganj', winnerName: 'Hem Narayan Sah', winnerParty: 'JD(U)', runnerUpName: 'Kumar Deo Ranjan Singh', runnerUpParty: 'BJP', margin: 20292 },
  { constNo: 113, name: 'Ekma', winnerName: 'Manoranjan Singh', winnerParty: 'JD(U)', runnerUpName: 'Kameshwar Kumar Singh', runnerUpParty: 'BJP', margin: 8126 },
  { constNo: 114, name: 'Manjhi', winnerName: 'Vijay Shanker Dubey', winnerParty: 'INC', runnerUpName: 'Keshav Singh', runnerUpParty: 'LJP', margin: 8866 },
  { constNo: 115, name: 'Baniapur', winnerName: 'Kedar Nath Singh', winnerParty: 'RJD', runnerUpName: 'Tarkeshwar Singh', runnerUpParty: 'BJP', margin: 15951 },
  { constNo: 116, name: 'Taraiya', winnerName: 'Mudrika Prasad Roy', winnerParty: 'RJD', runnerUpName: 'Janak Singh', runnerUpParty: 'BJP', margin: 20440 },
  { constNo: 117, name: 'Marhaura', winnerName: 'Jeetendra Kumar Rai', winnerParty: 'RJD', runnerUpName: 'Lal Babu Ray', runnerUpParty: 'BJP', margin: 16718 },
  { constNo: 118, name: 'Chapra', winnerName: 'Dr. C.N. Gupta', winnerParty: 'BJP', runnerUpName: 'Randhir Kumar Singh', runnerUpParty: 'RJD', margin: 11379 },
  { constNo: 119, name: 'Garkha', winnerName: 'Muneshwar Chaudhary', winnerParty: 'RJD', runnerUpName: 'Gyanchand Manjhi', runnerUpParty: 'BJP', margin: 39883 },
  { constNo: 120, name: 'Amnour', winnerName: 'Shatrudhan Tiwary', winnerParty: 'BJP', runnerUpName: 'Krishan Kumar Mantoo', runnerUpParty: 'JD(U)', margin: 5251 },
  { constNo: 121, name: 'Parsa', winnerName: 'Chandrika Rai', winnerParty: 'RJD', runnerUpName: 'Chhotelal Rai', runnerUpParty: 'LJP', margin: 42335 },
  { constNo: 122, name: 'Sonepur', winnerName: 'Dr. Ramanuj Prasad', winnerParty: 'RJD', runnerUpName: 'Vinay Kumar Singh', runnerUpParty: 'BJP', margin: 36396 },
  { constNo: 123, name: 'Hajipur', winnerName: 'Awadhesh Singh', winnerParty: 'BJP', runnerUpName: 'Jagannath Prasad Rai', runnerUpParty: 'INC', margin: 12195 },
  { constNo: 124, name: 'Lalganj', winnerName: 'Raj Kumar Sah', winnerParty: 'LJP', runnerUpName: 'Vijay Kumar Shukla', runnerUpParty: 'JD(U)', margin: 20293 },
  { constNo: 125, name: 'Vaishali', winnerName: 'Raj Kishore Singh', winnerParty: 'JD(U)', runnerUpName: 'Brishin Patel', runnerUpParty: 'HAM(S)', margin: 31061 },
  { constNo: 126, name: 'Mahua', winnerName: 'Tej Pratap Yadav', winnerParty: 'RJD', runnerUpName: 'Ravindra Ray', runnerUpParty: 'HAM(S)', margin: 28155 },
  { constNo: 127, name: 'Raja Pakar', winnerName: 'Shivchandra Ram', winnerParty: 'RJD', runnerUpName: 'Ram Nath Raman', runnerUpParty: 'LJP', margin: 15155 },
  { constNo: 128, name: 'Raghopur', winnerName: 'Tejashwi Prasad Yadav', winnerParty: 'RJD', runnerUpName: 'Satish Kumar', runnerUpParty: 'BJP', margin: 22733 },
  { constNo: 129, name: 'Manhar', winnerName: 'Umesh Singh Kushwaha', winnerParty: 'JD(U)', runnerUpName: 'Dr. Achuta Nand', runnerUpParty: 'BJP', margin: 26455 },
  { constNo: 130, name: 'Patepur', winnerName: 'Prema Chaudhary', winnerParty: 'RJD', runnerUpName: 'Mahendra Baitha', runnerUpParty: 'BJP', margin: 12461 },
  { constNo: 131, name: 'Kalyanpur', winnerName: 'Maheshwar Hazari', winnerParty: 'JD(U)', runnerUpName: 'Prince Raj', runnerUpParty: 'LJP', margin: 37686 },
  { constNo: 132, name: 'Warisnagar', winnerName: 'Ashok Kumar', winnerParty: 'JD(U)', runnerUpName: 'Chandrashekhar Rai', runnerUpParty: 'LJP', margin: 58573 },
  { constNo: 133, name: 'Samastipur', winnerName: 'Akhtarul Islam Shaheen', winnerParty: 'RJD', runnerUpName: 'Renu Kumari', runnerUpParty: 'BJP', margin: 31080 },
  { constNo: 134, name: 'Ujiarpur', winnerName: 'Alok Kumar Mehta', winnerParty: 'RJD', runnerUpName: 'Kumar Anant', runnerUpParty: 'RLSP', margin: 47460 },
  { constNo: 135, name: 'Morwa', winnerName: 'Vidya Sagar Singh Nishad', winnerParty: 'JD(U)', runnerUpName: 'Suresh Ray', runnerUpParty: 'BJP', margin: 18816 },
  { constNo: 136, name: 'Sarairanjan', winnerName: 'Vijay Kumar Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Ranjeet Nirguni', runnerUpParty: 'BJP', margin: 34044 },
  { constNo: 137, name: 'Mohiuddinnagar', winnerName: 'Ejya Yadav', winnerParty: 'RJD', runnerUpName: 'Rajesh Kumar Singh', runnerUpParty: 'IND', margin: 23431 },
  { constNo: 138, name: 'Bibhutpur', winnerName: 'Ram Balak Singh', winnerParty: 'JD(U)', runnerUpName: 'Ram Deo Verma', runnerUpParty: 'CPM', margin: 17235 },
  { constNo: 139, name: 'Rosera', winnerName: 'Dr. Ashok Kumar', winnerParty: 'INC', runnerUpName: 'Manju Hazari', runnerUpParty: 'BJP', margin: 34361 },
  { constNo: 140, name: 'Hasanpur', winnerName: 'Raj Kumar Ray', winnerParty: 'JD(U)', runnerUpName: 'Vinod Choudhary', runnerUpParty: 'RLSP', margin: 29600 },
  { constNo: 141, name: 'Cheria Bariarpur', winnerName: 'Kumari Manju Verma', winnerParty: 'JD(U)', runnerUpName: 'Anil Kumar Chaudhary', runnerUpParty: 'LJP', margin: 29736 },
  { constNo: 142, name: 'Bachwara', winnerName: 'Ramdeo Rai', winnerParty: 'INC', runnerUpName: 'Arvind Kumar Singh', runnerUpParty: 'LJP', margin: 36931 },
  { constNo: 143, name: 'Teghra', winnerName: 'Birendra Kumar', winnerParty: 'RJD', runnerUpName: 'Ram Lakhan Singh', runnerUpParty: 'BJP', margin: 15611 },
  { constNo: 144, name: 'Matihani', winnerName: 'Narendra Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Sarvesh Kumar', runnerUpParty: 'BJP', margin: 22688 },
  { constNo: 145, name: 'Sahebpur Kamal', winnerName: 'Shreenarayan Yadav', winnerParty: 'RJD', runnerUpName: 'M.D. Aslam', runnerUpParty: 'LJP', margin: 45474 },
  { constNo: 146, name: 'Begusarai', winnerName: 'Amita Bhushan', winnerParty: 'INC', runnerUpName: 'Surendra Mehta', runnerUpParty: 'BJP', margin: 16531 },
  { constNo: 147, name: 'Bakhri', winnerName: 'Upendra Paswan', winnerParty: 'RJD', runnerUpName: 'Ramanand Ram', runnerUpParty: 'BJP', margin: 40256 },
  { constNo: 148, name: 'Alauli', winnerName: 'Chandan Kumar', winnerParty: 'RJD', runnerUpName: 'Pashupati Kumar Paras', runnerUpParty: 'LJP', margin: 24470 },
  { constNo: 149, name: 'Khagaria', winnerName: 'Poonam Devi Yadav', winnerParty: 'JD(U)', runnerUpName: 'Rajesh Kumar', runnerUpParty: 'HAM(S)', margin: 25565 },
  { constNo: 150, name: 'Beldaur', winnerName: 'Panna Lal Singh Patel', winnerParty: 'JD(U)', runnerUpName: 'Mithilesh Kumar Nishad', runnerUpParty: 'LJP', margin: 13525 },
  { constNo: 151, name: 'Parbatta', winnerName: 'Ramanad Prasad Singh', winnerParty: 'JD(U)', runnerUpName: 'Ramanuj Choudhary', runnerUpParty: 'BJP', margin: 28924 },
  { constNo: 152, name: 'Bihpur', winnerName: 'Varsha Rani', winnerParty: 'RJD', runnerUpName: 'Kumar Shailendra', runnerUpParty: 'BJP', margin: 12716 },
  { constNo: 153, name: 'Gopalpur', winnerName: 'Narendra Kumar Niraj', winnerParty: 'JD(U)', runnerUpName: 'Anil Kumar Yadav', runnerUpParty: 'BJP', margin: 5169 },
  { constNo: 154, name: 'Pirpainti', winnerName: 'Ram Vilash Paswan', winnerParty: 'RJD', runnerUpName: 'Lalan Kumar', runnerUpParty: 'BJP', margin: 5144 },
  { constNo: 155, name: 'Kahalgaon', winnerName: 'Sadanand Singh', winnerParty: 'INC', runnerUpName: 'Niraj Kumar Mandal', runnerUpParty: 'LJP', margin: 21229 },
  { constNo: 156, name: 'Bhagalpur', winnerName: 'Ajeet Sharma', winnerParty: 'INC', runnerUpName: 'Arjit Shashwat Choubey', runnerUpParty: 'BJP', margin: 10658 },
  { constNo: 157, name: 'Sultanganj', winnerName: 'Subodh Roy', winnerParty: 'JD(U)', runnerUpName: 'Himanshu Prasad', runnerUpParty: 'RLSP', margin: 37397 },
  { constNo: 158, name: 'Nathnagar', winnerName: 'Ajay Kumar Mandal', winnerParty: 'JD(U)', runnerUpName: 'Amar Nath Prasad', runnerUpParty: 'LJP', margin: 7825 },
  { constNo: 159, name: 'Amarpur', winnerName: 'Janardan Manjhi', winnerParty: 'JD(U)', runnerUpName: 'Mrinal Shekhar', runnerUpParty: 'BJP', margin: 11773 },
  { constNo: 160, name: 'Dhuraiya', winnerName: 'Manish Kumar', winnerParty: 'JD(U)', runnerUpName: 'Bhudeo Choudhary', runnerUpParty: 'RLSP', margin: 24154 },
  { constNo: 161, name: 'Banka', winnerName: 'Ram Narayan Mandal', winnerParty: 'BJP', runnerUpName: 'Zafrul Hoda', runnerUpParty: 'RJD', margin: 3730 },
  { constNo: 162, name: 'Katoria', winnerName: 'Sweety Sima Hembram', winnerParty: 'RJD', runnerUpName: 'Nikki Hembram', runnerUpParty: 'BJP', margin: 10337 },
  { constNo: 163, name: 'Belhar', winnerName: 'Giridhari Yadav', winnerParty: 'JD(U)', runnerUpName: 'Manoj Yadav', runnerUpParty: 'BJP', margin: 16191 },
  { constNo: 164, name: 'Tarapur', winnerName: 'M L Choudhary', winnerParty: 'JD(U)', runnerUpName: 'Sakuni Choudhary', runnerUpParty: 'HAM(S)', margin: 11947 },
  { constNo: 165, name: 'Munger', winnerName: 'Vijay Kumar', winnerParty: 'RJD', runnerUpName: 'Pranav Kumar', runnerUpParty: 'BJP', margin: 4365 },
  { constNo: 166, name: 'Jamalpur', winnerName: 'Shailesh Kumar', winnerParty: 'JD(U)', runnerUpName: 'Himanshu Kunvar', runnerUpParty: 'LJP', margin: 15476 },
  { constNo: 167, name: 'Surajgarha', winnerName: 'Prahlad Yadav', winnerParty: 'RJD', runnerUpName: 'Prem Ranjan Patel', runnerUpParty: 'BJP', margin: 30030 },
  { constNo: 168, name: 'Lakhisarai', winnerName: 'Vijay Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Ramanand Mandal', runnerUpParty: 'JD(U)', margin: 6556 },
  { constNo: 169, name: 'Sheikhpura', winnerName: 'Randhir Kumar Soni', winnerParty: 'JD(U)', runnerUpName: 'Naresh Saw', runnerUpParty: 'HAM(S)', margin: 13101 },
  { constNo: 170, name: 'Barbigha', winnerName: 'Sudarshan Kumar', winnerParty: 'INC', runnerUpName: 'Sheo Kumar', runnerUpParty: 'RLSP', margin: 15717 },
  { constNo: 171, name: 'Asthawan', winnerName: 'Jitendra Kumar', winnerParty: 'JD(U)', runnerUpName: 'Chhote Lal Yadav', runnerUpParty: 'LJP', margin: 10444 },
  { constNo: 172, name: 'Biharsharif', winnerName: 'Dr. Sunil Kumar', winnerParty: 'BJP', runnerUpName: 'Mohammad Asghar Shamim', runnerUpParty: 'JD(U)', margin: 2340 },
  { constNo: 173, name: 'Rajgir', winnerName: 'Ravi Jyoti Kumar', winnerParty: 'JD(U)', runnerUpName: 'Satydeo Narain Arya', runnerUpParty: 'BJP', margin: 5390 },
  { constNo: 174, name: 'Islampur', winnerName: 'Chandrasen Prasad', winnerParty: 'JD(U)', runnerUpName: 'Birendra Gope', runnerUpParty: 'BJP', margin: 22602 },
  { constNo: 175, name: 'Hilsa', winnerName: 'Atri Muni Urph Shakti Singh Yadav', winnerParty: 'RJD', runnerUpName: 'Deepika Kumari', runnerUpParty: 'LJP', margin: 26076 },
  { constNo: 176, name: 'Nalanda', winnerName: 'Shrawon Kumar', winnerParty: 'JD(U)', runnerUpName: 'Kaushlendra Kumar', runnerUpParty: 'BJP', margin: 2996 },
  { constNo: 177, name: 'Harnaut', winnerName: 'Hari Narayan Singh', winnerParty: 'JD(U)', runnerUpName: 'Arun Kumar', runnerUpParty: 'LJP', margin: 14295 },
  { constNo: 178, name: 'Mokama', winnerName: 'Anant Kumar Singh', winnerParty: 'IND', runnerUpName: 'Neeraj Kumar', runnerUpParty: 'JD(U)', margin: 18348 },
  { constNo: 179, name: 'Barh', winnerName: 'Gyanendra Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Manoj Kumar', runnerUpParty: 'JD(U)', margin: 8359 },
  { constNo: 180, name: 'Bakhtiarpur', winnerName: 'Ranvijay Singh', winnerParty: 'BJP', runnerUpName: 'Aniruddh Kumar', runnerUpParty: 'RJD', margin: 7902 },
  { constNo: 181, name: 'Digha', winnerName: 'Sanjiv Chaurasia', winnerParty: 'BJP', runnerUpName: 'Rajeev Ranjan Prasad', runnerUpParty: 'JD(U)', margin: 24779 },
  { constNo: 182, name: 'Bankipur', winnerName: 'Nitin Naveen', winnerParty: 'BJP', runnerUpName: 'Kumar Ashish', runnerUpParty: 'INC', margin: 39767 },
  { constNo: 183, name: 'Kumhrar', winnerName: 'Arun Kumar Sinha', winnerParty: 'BJP', runnerUpName: 'Aquil Haider', runnerUpParty: 'INC', margin: 37275 },
  { constNo: 184, name: 'Patna Sahib', winnerName: 'Nand Kishore Yadav', winnerParty: 'BJP', runnerUpName: 'Santosh Mehta', runnerUpParty: 'RJD', margin: 2792 },
  { constNo: 185, name: 'Fatwa', winnerName: 'Dr. Rama Nand Yadav', winnerParty: 'RJD', runnerUpName: 'Satyendra Kumar Singh', runnerUpParty: 'LJP', margin: 30402 },
  { constNo: 186, name: 'Danapur', winnerName: 'Asha Devi', winnerParty: 'BJP', runnerUpName: 'Raj Kishor Yadav', runnerUpParty: 'RJD', margin: 5209 },
  { constNo: 187, name: 'Maner', winnerName: 'Bhai Virendra', winnerParty: 'RJD', runnerUpName: 'Shrikant Nirala', runnerUpParty: 'BJP', margin: 22828 },
  { constNo: 188, name: 'Phulwari', winnerName: 'Shyam Rajak', winnerParty: 'JD(U)', runnerUpName: 'Rajeshwar Manjhi', runnerUpParty: 'HAM(S)', margin: 45713 },
  { constNo: 189, name: 'Masaurhi', winnerName: 'Rekha Devi', winnerParty: 'RJD', runnerUpName: 'Nutan Paswan', runnerUpParty: 'HAM(S)', margin: 39186 },
  { constNo: 190, name: 'Paliganj', winnerName: 'Jay Vardhan Yadav', winnerParty: 'RJD', runnerUpName: 'Ram Janm Sharma', runnerUpParty: 'BJP', margin: 24453 },
  { constNo: 191, name: 'Bikram', winnerName: 'Siddharth', winnerParty: 'INC', runnerUpName: 'Anil Kumar', runnerUpParty: 'BJP', margin: 44311 },
  { constNo: 192, name: 'Sandesh', winnerName: 'Arun Kumar', winnerParty: 'RJD', runnerUpName: 'Sanjay Singh Tiger', runnerUpParty: 'BJP', margin: 25427 },
  { constNo: 193, name: 'Barhara', winnerName: 'Saroj Yadav', winnerParty: 'RJD', runnerUpName: 'Aasha Devi', runnerUpParty: 'BJP', margin: 13308 },
  { constNo: 194, name: 'Arrah', winnerName: 'Mohammad Nawaz Alam', winnerParty: 'RJD', runnerUpName: 'Amrendra Pratap Singh', runnerUpParty: 'BJP', margin: 666 },
  { constNo: 195, name: 'Agiaon', winnerName: 'Prabhunath Prasad', winnerParty: 'JD(U)', runnerUpName: 'Shivesh Kumar', runnerUpParty: 'BJP', margin: 14704 },
  { constNo: 196, name: 'Tarari', winnerName: 'Sudama Prasad', winnerParty: 'CPI(ML)(L)', runnerUpName: 'Gita Pandey', runnerUpParty: 'LJP', margin: 272 },
  { constNo: 197, name: 'Jagdishpur', winnerName: 'Ram Vishun Singh', winnerParty: 'RJD', runnerUpName: 'Rakesh Raushan', runnerUpParty: 'RLSP', margin: 10195 },
  { constNo: 198, name: 'Shahpur', winnerName: 'Rahul Tiwary', winnerParty: 'RJD', runnerUpName: 'Visheshwar Ojha', runnerUpParty: 'BJP', margin: 14570 },
  { constNo: 199, name: 'Barhampur', winnerName: 'Shambhu Nath Yadav', winnerParty: 'RJD', runnerUpName: 'Vivek Thakur', runnerUpParty: 'BJP', margin: 30776 },
  { constNo: 200, name: 'Buxar', winnerName: 'Sanjay Kumar Tiwari', winnerParty: 'INC', runnerUpName: 'Pradeep Dubey', runnerUpParty: 'BJP', margin: 10181 },
  { constNo: 201, name: 'Dumraon', winnerName: 'Dadan Yadav', winnerParty: 'JD(U)', runnerUpName: 'Ram Bihari Singh', runnerUpParty: 'RLSP', margin: 30339 },
  { constNo: 202, name: 'Rajpur', winnerName: 'Santosh Kumar Nirala', winnerParty: 'JD(U)', runnerUpName: 'Bishawnath Ram', runnerUpParty: 'BJP', margin: 32788 },
  { constNo: 203, name: 'Ramgarh', winnerName: 'Ashok Kumar Singh', winnerParty: 'BJP', runnerUpName: 'Ambika Singh', runnerUpParty: 'RJD', margin: 8011 },
  { constNo: 204, name: 'Mohania', winnerName: 'Niranjan Ram', winnerParty: 'BJP', runnerUpName: 'Sanjay Kumar', runnerUpParty: 'INC', margin: 7581 },
  { constNo: 205, name: 'Bhabua', winnerName: 'Anand Bhushan Pandey', winnerParty: 'BJP', runnerUpName: 'Doctor Pramod Kumar Singh', runnerUpParty: 'JD(U)', margin: 7744 },
  { constNo: 206, name: 'Chainpur', winnerName: 'Brij Kishor Bind', winnerParty: 'BJP', runnerUpName: 'Mohammad Zama Khan', runnerUpParty: 'BSP', margin: 671 },
  { constNo: 207, name: 'Chenari', winnerName: 'Lalan Paswan', winnerParty: 'RLSP', runnerUpName: 'Mangal Ram', runnerUpParty: 'INC', margin: 9781 },
  { constNo: 208, name: 'Sasaram', winnerName: 'Ashok Kumar', winnerParty: 'RJD', runnerUpName: 'Jawahar Prasad', runnerUpParty: 'BJP', margin: 19612 },
  { constNo: 209, name: 'Kargahar', winnerName: 'Bashisht Singh', winnerParty: 'JD(U)', runnerUpName: 'Birendra Kumar Singh', runnerUpParty: 'RLSP', margin: 12907 },
  { constNo: 210, name: 'Dinara', winnerName: 'Jai Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Rajendra Prasad Singh', runnerUpParty: 'BJP', margin: 2691 },
  { constNo: 211, name: 'Nokha', winnerName: 'Anita Devi', winnerParty: 'RJD', runnerUpName: 'Rameshwar Prasad', runnerUpParty: 'BJP', margin: 22998 },
  { constNo: 212, name: 'Dehri', winnerName: 'Mohammad Iliyas Hussain', winnerParty: 'RJD', runnerUpName: 'Jitendra Kumar', runnerUpParty: 'RLSP', margin: 3898 },
  { constNo: 213, name: 'Karakat', winnerName: 'Sanjay Kumar Singh', winnerParty: 'RJD', runnerUpName: 'Rajeshwar Raj', runnerUpParty: 'BJP', margin: 12119 },
  { constNo: 214, name: 'Arwal', winnerName: 'Ravindra Singh', winnerParty: 'RJD', runnerUpName: 'Chitranjan Kumar', runnerUpParty: 'BJP', margin: 17810 },
  { constNo: 215, name: 'Kurtha', winnerName: 'Satyadeo Singh', winnerParty: 'JD(U)', runnerUpName: 'Ashok Kumar Verma', runnerUpParty: 'RLSP', margin: 14119 },
  { constNo: 216, name: 'Jahanabad', winnerName: 'Mundrika Singh Yadav', winnerParty: 'RJD', runnerUpName: 'Praveen Kumar', runnerUpParty: 'RLSP', margin: 30321 },
  { constNo: 217, name: 'Ghosi', winnerName: 'Krishan Nandan Prasad Verma', winnerParty: 'JD(U)', runnerUpName: 'Rahul Kumar', runnerUpParty: 'HAM(S)', margin: 21625 },
  { constNo: 218, name: 'Makhdumpur', winnerName: 'Subedar Das', winnerParty: 'RJD', runnerUpName: 'Jitan Ram Manjhi', runnerUpParty: 'HAM(S)', margin: 26777 },
  { constNo: 219, name: 'Goh', winnerName: 'Manoj Kumar', winnerParty: 'BJP', runnerUpName: 'Doctor Ranvijay Kumar', runnerUpParty: 'JD(U)', margin: 7672 },
  { constNo: 220, name: 'Obra', winnerName: 'Birendra Kumar Sinha', winnerParty: 'RJD', runnerUpName: 'Chandra Bhushan Verma', runnerUpParty: 'RLSP', margin: 11396 },
  { constNo: 221, name: 'Nabinagar', winnerName: 'Virendra Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Gopal Narayan Singh', runnerUpParty: 'BJP', margin: 5261 },
  { constNo: 222, name: 'Kutumba', winnerName: 'Rajesh Kumar', winnerParty: 'INC', runnerUpName: 'Santosh Kumar Suman', runnerUpParty: 'HAM(S)', margin: 10098 },
  { constNo: 223, name: 'Aurangabad', winnerName: 'Anand Shankar Singh', winnerParty: 'INC', runnerUpName: 'Ramadhar Singh', runnerUpParty: 'BJP', margin: 18398 },
  { constNo: 224, name: 'Rafiganj', winnerName: 'Ashok Kumar Singh', winnerParty: 'JD(U)', runnerUpName: 'Pramod Kumar Singh', runnerUpParty: 'LJP', margin: 9525 },
  { constNo: 225, name: 'Gurua', winnerName: 'Rajiv Nandan', winnerParty: 'BJP', runnerUpName: 'Ramchandra Prasad Singh', runnerUpParty: 'JD(U)', margin: 6515 },
  { constNo: 226, name: 'Sherghati', winnerName: 'Vinod Prasad Yadav', winnerParty: 'JD(U)', runnerUpName: 'Mukesh Kumar Yadav', runnerUpParty: 'HAM(S)', margin: 4834 },
  { constNo: 227, name: 'Imamganj', winnerName: 'Jitan Ram Manjhi', winnerParty: 'HAM(S)', runnerUpName: 'Uday Narain Choudhary', runnerUpParty: 'JD(U)', margin: 29408 },
  { constNo: 228, name: 'Barachatti', winnerName: 'Samta Devi', winnerParty: 'RJD', runnerUpName: 'Sudha Devi', runnerUpParty: 'LJP', margin: 19126 },
  { constNo: 229, name: 'Bodh Gaya', winnerName: 'Kumar Sarvjeet', winnerParty: 'RJD', runnerUpName: 'Shyamdeo Paswan', runnerUpParty: 'BJP', margin: 30473 },
  { constNo: 230, name: 'Gaya Town', winnerName: 'Prem Kumar', winnerParty: 'BJP', runnerUpName: 'Priya Ranjan', runnerUpParty: 'INC', margin: 22789 },
  { constNo: 231, name: 'Tikari', winnerName: 'Abhay Kumar Sinha', winnerParty: 'JD(U)', runnerUpName: 'Anil Kumar', runnerUpParty: 'HAM(S)', margin: 31813 },
  { constNo: 232, name: 'Belaganj', winnerName: 'Surendra Prasad Yadav', winnerParty: 'RJD', runnerUpName: 'Sharim Ali', runnerUpParty: 'HAM(S)', margin: 30341 },
  { constNo: 233, name: 'Atri', winnerName: 'Kunti Devi', winnerParty: 'RJD', runnerUpName: 'Arvind Kumar Singh', runnerUpParty: 'LJP', margin: 13817 },
  { constNo: 234, name: 'Wazirganj', winnerName: 'Awadhesh Kumar Singh', winnerParty: 'INC', runnerUpName: 'Birendra Singh', runnerUpParty: 'BJP', margin: 12759 },
  { constNo: 235, name: 'Rajauli', winnerName: 'Prakash Veer', winnerParty: 'RJD', runnerUpName: 'Arjun Ram', runnerUpParty: 'BJP', margin: 4615 },
  { constNo: 236, name: 'Hisua', winnerName: 'Anil Singh', winnerParty: 'BJP', runnerUpName: 'Kaushal Yadav', runnerUpParty: 'JD(U)', margin: 12239 },
  { constNo: 237, name: 'Nawada', winnerName: 'Rajballabh Prasad', winnerParty: 'RJD', runnerUpName: 'Indradeo Prasad', runnerUpParty: 'RLSP', margin: 16726 },
  { constNo: 238, name: 'Gobindpur', winnerName: 'Purnima Yadav', winnerParty: 'INC', runnerUpName: 'Fula Devi', runnerUpParty: 'BJP', margin: 4399 },
  { constNo: 239, name: 'Warsaliganj', winnerName: 'Aruna Devi', winnerParty: 'BJP', runnerUpName: 'Pradip Kumar', runnerUpParty: 'JD(U)', margin: 19527 },
  { constNo: 240, name: 'Sikandra', winnerName: 'Sudhir Kumar', winnerParty: 'INC', runnerUpName: 'Subhash Chandra Bosh', runnerUpParty: 'LJP', margin: 7990 },
  { constNo: 241, name: 'Jamui', winnerName: 'Vijay Prakash', winnerParty: 'RJD', runnerUpName: 'Ajoy Pratap', runnerUpParty: 'BJP', margin: 8249 },
  { constNo: 242, name: 'Jhajha', winnerName: 'Rabindra Yadav', winnerParty: 'BJP', runnerUpName: 'Damodar Rawat', runnerUpParty: 'JD(U)', margin: 22086 },
  { constNo: 243, name: 'Chakai', winnerName: 'Savitri Devi', winnerParty: 'RJD', runnerUpName: 'Sumit Kumar Singh', runnerUpParty: 'IND', margin: 13113 },
];

/** Parties confirmed in DB from prior seeds */
const EXISTING_IN_SEED = new Set([
  'BJP', 'INC', 'JDU', 'RJD', 'LJPRV', 'HAM', 'BSP', 'AAP', 'CPIM', 'CPI',
  'AIMIM', 'AIFB', 'NCPSP', 'NCP', 'AP1', 'JMM', 'RLM', 'BP', 'IND', 'NOTA',
  'CPIML', 'HAMS', 'VSIP', 'LJP', 'JTVP',
]);

/** Full party names for new party inserts */
const PARTY_FULL_NAMES: Record<string, string> = {
  RLSP: 'Rashtriya Lok Samta Party',
};

function main() {
  console.log('=== Bihar Vidhan Sabha 2015 Seed Generator ===\n');

  const lines: string[] = [];
  lines.push('-- Bihar Vidhan Sabha 2015 Election Data');
  lines.push('-- Source: elections.in (winner + runner-up per constituency)');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_bihar_vs_2015.sql');
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
  lines.push(`  ('${ELECTION_ID}', 'Bihar Vidhan Sabha 2015', 'VS', ${STATE_ID}, 2015, 'Finalized', NULL)`);
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

  // Manifest — In 2015, JDU+RJD+INC were in Mahagathbandhan; BJP+LJP+RLSP+HAM(S) were NDA
  const manifest = {
    alliances: [
      {
        id: 'MGB',
        name: 'Mahagathbandhan',
        color: '#2E8B57',
        parties: ['RJD', 'JDU', 'INC', 'CPI', 'CPIM', 'CPIML'],
      },
      {
        id: 'NDA',
        name: 'National Democratic Alliance',
        color: '#FF6B00',
        parties: ['BJP', 'LJP', 'RLSP', 'HAMS'],
      },
    ],
    leaders: [
      { name: 'Nitish Kumar', party_id: 'JDU', const_id: '' },
      { name: 'Lalu Prasad Yadav', party_id: 'RJD', const_id: '' },
    ],
    cabinet: [],
    tracked: ['MGB', 'NDA', 'AIMIM', 'BSP'],
    vip_seats: {},
    milestones: [{ label: 'Majority', value: 122 }],
    compare_with: ['a1b2c3d4-e5f6-7890-abcd-111111111010'],
    geo: {
      map_url: '/geo/bihar_ac_2008.geojson',
      center: [85.5, 25.6] as [number, number],
      zoom: 8,
    },
    delimitation_era: '2008',
  };

  lines.push('-- Manifest');
  lines.push(`UPDATE elections SET manifest_url = '${esc(JSON.stringify(manifest))}' WHERE id = '${ELECTION_ID}';`);
  lines.push('');

  // Write file
  const outPath = path.resolve(__dirname, '../../database/seed_bihar_vs_2015.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Done! Wrote ${outPath}`);
  console.log(`  ${RAW_DATA.length} constituencies`);
  console.log(`  ${totalCandidates} candidates`);
}

main();
