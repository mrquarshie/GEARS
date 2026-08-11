import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { X, Pencil, Trash, Plus, Wrench } from '@phosphor-icons/react';
import { collection, addDoc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BookmarkIcon,
  CallIcon,
  LocationIcon,
  RateIcon,
  ShareIcon,
  StarRatingIcon,
} from './icons';

function getCategory(specialty) {
  if (specialty === 'Car Detailing') return 'detailer';
  if (specialty === 'Fuel Station') return 'fuel';
  return 'standard';
}

function HouseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M8.5 2.00005V13.5001H2.5V5.33443C2.49995 5.25209 2.52023 5.17101 2.55904 5.0984C2.59786 5.02578 2.65401 4.96387 2.7225 4.91818L7.7225 1.58505C7.79773 1.53486 7.88516 1.50601 7.97549 1.50158C8.06582 1.49714 8.15566 1.51729 8.23544 1.55988C8.31523 1.60246 8.38196 1.66589 8.42855 1.7434C8.47514 1.82092 8.49983 1.90962 8.5 2.00005Z" fill="black" />
      <path d="M15 12.9999H14V5.99992C14 5.7347 13.8946 5.48035 13.7071 5.29281C13.5196 5.10528 13.2652 4.99992 13 4.99992H9V1.99992C9.00012 1.81883 8.95106 1.64111 8.85807 1.48573C8.76507 1.33035 8.63163 1.20313 8.47199 1.11766C8.31234 1.03219 8.13248 0.991676 7.95161 1.00044C7.77073 1.0092 7.59564 1.06692 7.445 1.16742L2.445 4.49992C2.30784 4.59143 2.19543 4.71544 2.11779 4.86091C2.04015 5.00637 1.99969 5.16878 2 5.33367V12.9999H1C0.867392 12.9999 0.740215 13.0526 0.646447 13.1464C0.552678 13.2401 0.5 13.3673 0.5 13.4999C0.5 13.6325 0.552678 13.7597 0.646447 13.8535C0.740215 13.9472 0.867392 13.9999 1 13.9999H15C15.1326 13.9999 15.2598 13.9472 15.3536 13.8535C15.4473 13.7597 15.5 13.6325 15.5 13.4999C15.5 13.3673 15.4473 13.2401 15.3536 13.1464C15.2598 13.0526 15.1326 12.9999 15 12.9999ZM13 5.99992V12.9999H9V5.99992H13ZM3 5.33367L8 1.99992V12.9999H3V5.33367ZM7 6.99992V7.99992C7 8.13253 6.94732 8.2597 6.85355 8.35347C6.75979 8.44724 6.63261 8.49992 6.5 8.49992C6.36739 8.49992 6.24021 8.44724 6.14645 8.35347C6.05268 8.2597 6 8.13253 6 7.99992V6.99992C6 6.86731 6.05268 6.74013 6.14645 6.64636C6.24021 6.5526 6.36739 6.49992 6.5 6.49992C6.63261 6.49992 6.75979 6.5526 6.85355 6.64636C6.94732 6.74013 7 6.86731 7 6.99992ZM5 6.99992V7.99992C5 8.13253 4.94732 8.2597 4.85355 8.35347C4.75979 8.44724 4.63261 8.49992 4.5 8.49992C4.36739 8.49992 4.24021 8.44724 4.14645 8.35347C4.05268 8.2597 4 8.13253 4 7.99992V6.99992C4 6.86731 4.05268 6.74013 4.14645 6.64636C4.24021 6.5526 4.36739 6.49992 4.5 6.49992C4.63261 6.49992 6.75979 6.5526 6.85355 6.64636C6.94732 6.74013 7 6.86731 7 6.99992ZM5 10.4999V11.4999C5 11.6325 4.94732 11.7597 4.85355 11.8535C4.75979 11.9472 4.63261 11.9999 4.5 11.9999C4.36739 11.9999 4.24021 11.9472 4.14645 11.8535C4.05268 11.7597 4 11.6325 4 11.4999V10.4999C4 10.3673 4.05268 10.2401 4.14645 10.1464C4.24021 10.0526 4.36739 9.99992 4.5 9.99992C4.63261 9.99992 4.75979 10.0526 4.85355 10.1464C4.94732 10.2401 5 10.3673 5 10.4999ZM7 10.4999V11.4999C7 11.6325 6.94732 11.7597 6.85355 11.8535C6.75979 11.9472 6.63261 11.9999 6.5 11.9999C6.36739 11.9999 6.24021 11.9472 6.14645 11.8535C6.05268 11.7597 6 11.6325 6 11.4999V10.4999C6 10.3673 6.05268 10.2401 6.14645 10.1464C6.24021 10.0526 6.36739 9.99992 6.5 9.99992C6.63261 9.99992 6.75979 10.0526 6.85355 10.1464C6.94732 10.2401 7 10.3673 7 10.4999Z" fill="black" />
    </svg>
  );
}

function PinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M8 1.5C6.67392 1.5 5.40215 2.02678 4.46447 2.96447C3.52678 3.90215 3 5.17392 3 6.5C3 11 8 14.5 8 14.5C8 14.5 13 11 13 6.5C13 5.17392 12.4732 3.90215 11.5355 2.96447C10.5979 2.02678 9.32608 1.5 8 1.5ZM8 8.5C7.60444 8.5 7.21776 8.3827 6.88886 8.16294C6.55996 7.94318 6.30362 7.63082 6.15224 7.26537C6.00087 6.89991 5.96126 6.49778 6.03843 6.10982C6.1156 5.72186 6.30608 5.36549 6.58579 5.08579C6.86549 4.80608 7.22186 4.6156 7.60982 4.53843C7.99778 4.46126 8.39991 4.50087 8.76537 4.65224C9.13082 4.80362 9.44318 5.05996 9.66294 5.38886C9.8827 5.71776 10 6.10444 10 6.5C10 7.03043 9.78929 7.53914 9.41421 7.91421C9.03914 8.28929 8.53043 8.5 8 8.5Z" fill="black" />
      <path d="M8 4C7.50555 4 7.0222 4.14662 6.61107 4.42133C6.19995 4.69603 5.87952 5.08648 5.6903 5.54329C5.50108 6.00011 5.45157 6.50277 5.54804 6.98773C5.6445 7.47268 5.8826 7.91814 6.23223 8.26777C6.58186 8.6174 7.02732 8.8555 7.51227 8.95196C7.99723 9.04843 8.49989 8.99892 8.95671 8.8097C9.41352 8.62048 9.80397 8.30005 10.0787 7.88893C10.3534 7.4778 10.5 6.99445 10.5 6.5C10.5 5.83696 10.2366 5.20107 9.76777 4.73223C9.29893 4.26339 8.66304 4 8 4ZM8 8C7.70333 8 7.41332 7.91203 7.16664 7.7472C6.91997 7.58238 6.72771 7.34811 6.61418 7.07403C6.50065 6.79994 6.47094 6.49834 6.52882 6.20736C6.5867 5.91639 6.72956 5.64912 6.93934 5.43934C7.14912 5.22956 7.41639 5.0867 7.70736 5.02882C7.99834 4.97094 8.29994 5.00065 8.57403 5.11418C8.84811 5.22771 9.08238 5.41997 9.2472 5.66664C9.41203 5.91332 9.5 6.20333 9.5 6.5C9.5 6.89782 9.34196 7.27936 9.06066 7.56066C8.77936 7.84196 8.39782 8 8 8ZM8 1C6.54182 1.00165 5.14383 1.58165 4.11274 2.61274C3.08165 3.64383 2.50165 5.04182 2.5 6.5C2.5 8.4625 3.40688 10.5425 5.125 12.5156C5.89701 13.4072 6.76591 14.2101 7.71562 14.9094C7.79969 14.9683 7.89985 14.9999 8.0025 14.9999C8.10515 14.9999 8.20531 14.9683 8.28938 14.9094C9.23734 14.2098 10.1046 13.4069 10.875 12.5156C12.5906 10.5425 13.5 8.4625 13.5 6.5C13.4983 5.04182 12.9184 3.64383 11.8873 2.61274C10.8562 1.58165 9.45818 1.00165 8 1ZM8 13.875C6.96687 13.0625 3.5 10.0781 3.5 6.5C3.5 5.30653 3.97411 4.16193 4.81802 3.31802C5.66193 2.47411 6.80653 2 8 2C9.19347 2 10.3381 2.47411 11.182 3.31802C12.0259 4.16193 12.5 5.30653 12.5 6.5C12.5 10.0769 9.03313 13.0625 8 13.875Z" fill="black" />
    </svg>
  );
}

function ClockIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M14 8C14 9.18669 13.6481 10.3467 12.9888 11.3334C12.3295 12.3201 11.3925 13.0892 10.2961 13.5433C9.19975 13.9974 7.99335 14.1162 6.82946 13.8847C5.66558 13.6532 4.59648 13.0818 3.75736 12.2426C2.91825 11.4035 2.3468 10.3344 2.11529 9.17054C1.88378 8.00666 2.0026 6.80026 2.45673 5.7039C2.91085 4.60754 3.67989 3.67047 4.66658 3.01118C5.65328 2.35189 6.81331 2 8 2C9.5913 2 11.1174 2.63214 12.2426 3.75736C13.3679 4.88258 14 6.4087 14 8Z" fill="black" />
      <path d="M8 1.5C6.71442 1.5 5.45772 1.88122 4.3888 2.59545C3.31988 3.30968 2.48676 4.32484 1.99479 5.51256C1.50282 6.70028 1.37409 8.00721 1.6249 9.26809C1.8757 10.529 2.49477 11.6872 3.40381 12.5962C4.31285 13.5052 5.47104 14.1243 6.73192 14.3751C7.99279 14.6259 9.29973 14.4972 10.4874 14.0052C11.6752 13.5132 12.6903 12.6801 13.4046 11.6112C14.1188 10.5423 14.5 9.28558 14.5 8C14.4982 6.27665 13.8128 4.62441 12.5942 3.40582C11.3756 2.18722 9.72335 1.50182 8 1.5ZM8 13.5C6.91221 13.5 5.84884 13.1774 4.94437 12.5731C4.0399 11.9687 3.33495 11.1098 2.91867 10.1048C2.50238 9.09977 2.39347 7.9939 2.60568 6.927C2.8179 5.86011 3.34173 4.8801 4.11092 4.11091C4.8801 3.34172 5.86011 2.8179 6.92701 2.60568C7.9939 2.39346 9.09977 2.50238 10.1048 2.91866C11.1098 3.33494 11.9687 4.03989 12.5731 4.94436C13.1774 5.84883 13.5 6.9122 13.5 8C13.4983 9.45818 12.9184 10.8562 11.8873 11.8873C10.8562 12.9184 9.45819 13.4983 8 13.5ZM12 8C12 8.13261 11.9473 8.25979 11.8536 8.35355C11.7598 8.44732 11.6326 8.5 11.5 8.5H8C7.86739 8.5 7.74022 8.44732 7.64645 8.35355C7.55268 8.25979 7.5 8.13261 7.5 8V4.5C7.5 4.36739 7.55268 4.24021 7.64645 4.14645C7.74022 4.05268 7.86739 4 8 4C8.13261 4 8.25979 4.05268 8.35356 4.14645C8.44732 4.24021 8.5 4.36739 8.5 4.5V7.5H11.5C11.6326 7.5 11.7598 7.55268 11.8536 7.64645C11.9473 7.74021 12 7.86739 12 8Z" fill="black" />
    </svg>
  );
}

function PhoneIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect opacity="0.2" x="3" y="1" width="10" height="14" rx="2" fill="black" />
      <rect x="2.5" y="0.5" width="11" height="15" rx="2.5" stroke="black" strokeWidth="0.75" />
      <rect x="6.5" y="12" width="3" height="1" rx="0.5" fill="black" opacity="0.4" />
    </svg>
  );
}

function getVerificationTier(mechanic) {
  if (mechanic.verified) return 1;
  if (mechanic.claimed) return 2;
  return 3;
}

function VerifiedIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M14.5 8C14.5 8.78188 13.3863 9.37188 13.0825 10.1056C12.79 10.8131 13.1712 12.0212 12.5962 12.5962C12.0212 13.1712 10.8131 12.79 10.1056 13.0825C9.375 13.3863 8.78125 14.5 8 14.5C7.21875 14.5 6.625 13.3863 5.89437 13.0825C5.18687 12.79 3.97875 13.1712 3.40375 12.5962C2.82875 12.0212 3.21 10.8131 2.9175 10.1056C2.61375 9.375 1.5 8.78125 1.5 8C1.5 7.21875 2.61375 6.625 2.9175 5.89437C3.21 5.1875 2.82875 3.97875 3.40375 3.40375C3.97875 2.82875 5.1875 3.21 5.89437 2.9175C6.62812 2.61375 7.21875 1.5 8 1.5C8.78125 1.5 9.375 2.61375 10.1056 2.9175C10.8131 3.21 12.0212 2.82875 12.5962 3.40375C13.1712 3.97875 12.79 5.18687 13.0825 5.89437C13.3863 6.62812 14.5 7.21875 14.5 8Z" fill="#145E42" />
      <path d="M14.1163 6.42625C13.8806 6.18 13.6369 5.92625 13.545 5.70312C13.46 5.49875 13.455 5.16 13.45 4.83187C13.4406 4.22187 13.4306 3.53062 12.95 3.05C12.4694 2.56937 11.7781 2.55937 11.1681 2.55C10.84 2.545 10.5012 2.54 10.2969 2.455C10.0744 2.36312 9.82 2.11937 9.57375 1.88375C9.1425 1.46937 8.6525 1 8 1C7.3475 1 6.85812 1.46937 6.42625 1.88375C6.18 2.11937 5.92625 2.36312 5.70312 2.455C5.5 2.54 5.16 2.545 4.83187 2.55C4.22187 2.55937 3.53062 2.56937 3.05 3.05C2.56937 3.53062 2.5625 4.22187 2.55 4.83187C2.545 5.16 2.54 5.49875 2.455 5.70312C2.36312 5.92562 2.11937 6.18 1.88375 6.42625C1.46937 6.8575 1 7.3475 1 8C1 8.6525 1.46937 9.14187 1.88375 9.57375C2.11937 9.82 2.36312 10.0738 2.455 10.2969C2.54 10.5012 2.545 10.84 2.55 11.1681C2.55937 11.7781 2.56937 12.4694 3.05 12.95C3.53062 13.4306 4.22187 13.4406 4.83187 13.45C5.16 13.455 5.49875 13.46 5.70312 13.545C5.92562 13.6369 6.18 13.8806 6.42625 14.1163C6.8575 14.5306 7.3475 15 8 15C8.6525 15 9.14187 14.5306 9.57375 14.1163C9.82 13.8806 10.0738 13.6369 10.2969 13.545C10.5012 13.46 10.84 13.455 11.1681 13.45C11.7781 13.4406 12.4694 13.4306 12.95 12.95C13.4306 12.4694 13.4406 11.7781 13.45 11.1681C13.455 10.84 13.46 10.5012 13.545 10.2969C13.6369 10.0744 13.8806 9.82 14.1163 9.57375C14.5306 9.1425 15 8.6525 15 8C15 7.3475 14.5306 6.85812 14.1163 6.42625ZM13.3944 8.88188C13.095 9.19438 12.785 9.5175 12.6206 9.91438C12.4631 10.2956 12.4562 10.7312 12.45 11.1531C12.4437 11.5906 12.4369 12.0488 12.2425 12.2425C12.0481 12.4363 11.5931 12.4437 11.1531 12.45C10.7312 12.4562 10.2956 12.4631 9.91438 12.6206C9.5175 12.785 9.19438 13.095 8.88188 13.3944C8.56938 13.6937 8.25 14 8 14C7.75 14 7.42812 13.6925 7.11812 13.3944C6.80812 13.0962 6.4825 12.785 6.08563 12.6206C5.70438 12.4631 5.26875 12.4562 4.84688 12.45C4.40938 12.4437 3.95125 12.4369 3.7575 12.2425C3.56375 12.0481 3.55625 11.5931 3.55 11.1531C3.54375 10.7312 3.53687 10.2956 3.37937 9.91438C3.215 9.5175 2.905 9.19438 2.60562 8.88188C2.30625 8.56938 2 8.25 2 8C2 7.75 2.3075 7.42812 2.60562 7.11812C2.90375 6.80812 3.215 6.4825 3.37937 6.08563C3.53687 5.70438 3.54375 5.26875 3.55 4.84688C3.55625 4.40938 3.56312 3.95125 3.7575 3.7575C3.95187 3.56375 4.40688 3.55625 4.84688 3.55C5.26875 3.54375 5.70438 3.53687 6.08563 3.37937C6.4825 3.215 6.80562 2.905 7.11812 2.60562C7.43062 2.30625 7.75 2 8 2C8.25 2 8.57188 2.3075 8.88188 2.60562C9.19188 2.90375 9.5175 3.215 9.91438 3.37937C10.2956 3.53687 10.7312 3.54375 11.1531 3.55C11.5906 3.55625 12.0488 3.56312 12.2425 3.7575C12.4363 3.95187 12.4437 4.40688 12.45 4.84688C12.4562 5.26875 12.4631 5.70438 12.6206 6.08563C12.785 6.4825 13.095 6.80562 13.3944 7.11812C13.6937 7.43062 14 7.75 14 8C14 8.25 13.6925 8.57188 13.3944 8.88188ZM10.8538 6.14625C10.9002 6.19269 10.9371 6.24783 10.9623 6.30853C10.9874 6.36923 11.0004 6.43429 11.0004 6.5C11.0004 6.56571 10.9874 6.63077 10.9623 6.69147C10.9371 6.75217 10.9002 6.80731 10.8538 6.85375L7.35375 10.3538C7.30731 10.4002 7.25217 10.4371 7.19147 10.4623C7.13077 10.4874 7.06571 10.5004 7 10.5004C6.93429 10.5004 6.86923 10.4874 6.80853 10.4623C6.74783 10.4371 6.69269 10.4002 6.64625 10.3538L5.14625 8.85375C5.05243 8.75993 4.99972 8.63268 4.99972 8.5C4.99972 8.36732 5.05243 8.24007 5.14625 8.14625C5.24007 8.05243 5.36732 7.99972 5.5 7.99972C5.63268 7.99972 5.75993 8.05243 5.85375 8.14625L7 9.29313L10.1462 6.14625C10.1927 6.09976 10.2478 6.06288 10.3085 6.03772C10.3692 6.01256 10.4343 5.99961 10.5 5.99961C10.5657 5.99961 10.6308 6.01256 10.6915 6.03772C10.7522 6.06288 10.8073 6.09976 10.8538 6.14625Z" fill="#145E42" />
    </svg>
  );
}

function ClaimedIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M14.5 8C14.5 8.78188 13.3863 9.37188 13.0825 10.1056C12.79 10.8131 13.1712 12.0212 12.5962 12.5962C12.0212 13.1712 10.8131 12.79 10.1056 13.0825C9.375 13.3863 8.78125 14.5 8 14.5C7.21875 14.5 6.625 13.3863 5.89437 13.0825C5.18687 12.79 3.97875 13.1712 3.40375 12.5962C2.82875 12.0212 3.21 10.8131 2.9175 10.1056C2.61375 9.375 1.5 8.78125 1.5 8C1.5 7.21875 2.61375 6.625 2.9175 5.89437C3.21 5.1875 2.82875 3.97875 3.40375 3.40375C3.97875 2.82875 5.1875 3.21 5.89437 2.9175C6.62812 2.61375 7.21875 1.5 8 1.5C8.78125 1.5 9.375 2.61375 10.1056 2.9175C10.8131 3.21 12.0212 2.82875 12.5962 3.40375C13.1712 3.97875 12.79 5.18687 13.0825 5.89437C13.3863 6.62812 14.5 7.21875 14.5 8Z" fill="black" fillOpacity="0.4" />
      <path d="M14.1163 6.42625C13.8806 6.18 13.6369 5.92625 13.545 5.70312C13.46 5.49875 13.455 5.16 13.45 4.83187C13.4406 4.22187 13.4306 3.53062 12.95 3.05C12.4694 2.56937 11.7781 2.55937 11.1681 2.55C10.84 2.545 10.5012 2.54 10.2969 2.455C10.0744 2.36312 9.82 2.11937 9.57375 1.88375C9.1425 1.46937 8.6525 1 8 1C7.3475 1 6.85812 1.46937 6.42625 1.88375C6.18 2.11937 5.92625 2.36312 5.70312 2.455C5.5 2.54 5.16 2.545 4.83187 2.55C4.22187 2.55937 3.53062 2.56937 3.05 3.05C2.56937 3.53062 2.5625 4.22187 2.55 4.83187C2.545 5.16 2.54 5.49875 2.455 5.70312C2.36312 5.92562 2.11937 6.18 1.88375 6.42625C1.46937 6.8575 1 7.3475 1 8C1 8.6525 1.46937 9.14187 1.88375 9.57375C2.11937 9.82 2.36312 10.0738 2.455 10.2969C2.54 10.5012 2.545 10.84 2.55 11.1681C2.55937 11.7781 2.56937 12.4694 3.05 12.95C3.53062 13.4306 4.22187 13.4406 4.83187 13.45C5.16 13.455 5.49875 13.46 5.70312 13.545C5.92562 13.6369 6.18 13.8806 6.42625 14.1163C6.8575 14.5306 7.3475 15 8 15C8.6525 15 9.14187 14.5306 9.57375 14.1163C9.82 13.8806 10.0738 13.6369 10.2969 13.545C10.5012 13.46 10.84 13.455 11.1681 13.45C11.7781 13.4406 12.4694 13.4306 12.95 12.95C13.4306 12.4694 13.4406 11.7781 13.45 11.1681C13.455 10.84 13.46 10.5012 13.545 10.2969C13.6369 10.0744 13.8806 9.82 14.1163 9.57375C14.5306 9.1425 15 8.6525 15 8C15 7.3475 14.5306 6.85812 14.1163 6.42625ZM13.3944 8.88188C13.095 9.19438 12.785 9.5175 12.6206 9.91438C12.4631 10.2956 12.4562 10.7312 12.45 11.1531C12.4437 11.5906 12.4369 12.0488 12.2425 12.2425C12.0481 12.4363 11.5931 12.4437 11.1531 12.45C10.7312 12.4562 10.2956 12.4631 9.91438 12.6206C9.5175 12.785 9.19438 13.095 8.88188 13.3944C8.56938 13.6937 8.25 14 8 14C7.75 14 7.42812 13.6925 7.11812 13.3944C6.80812 13.0962 6.4825 12.785 6.08563 12.6206C5.70438 12.4631 5.26875 12.4562 4.84688 12.45C4.40938 12.4437 3.95125 12.4369 3.7575 12.2425C3.56375 12.0481 3.55625 11.5931 3.55 11.1531C3.54375 10.7312 3.53687 10.2956 3.37937 9.91438C3.215 9.5175 2.905 9.19438 2.60562 8.88188C2.30625 8.56938 2 8.25 2 8C2 7.75 2.3075 7.42812 2.60562 7.11812C2.90375 6.80812 3.215 6.4825 3.37937 6.08563C3.53687 5.70438 3.54375 5.26875 3.55 4.84688C3.55625 4.40938 3.56312 3.95125 3.7575 3.7575C3.95187 3.56375 4.40688 3.55625 4.84688 3.55C5.26875 3.54375 5.70438 3.53687 6.08563 3.37937C6.4825 3.215 6.80562 2.905 7.11812 2.60562C7.43062 2.30625 7.75 2 8 2C8.25 2 8.57188 2.3075 8.88188 2.60562C9.19188 2.90375 9.5175 3.215 9.91438 3.37937C10.2956 3.53687 10.7312 3.54375 11.1531 3.55C11.5906 3.55625 12.0488 3.56312 12.2425 3.7575C12.4363 3.95187 12.4437 4.40688 12.45 4.84688C12.4562 5.26875 12.4631 5.70438 12.6206 6.08563C12.785 6.4825 13.095 6.80562 13.3944 7.11812C13.6937 7.43062 14 7.75 14 8C14 8.25 13.6925 8.57188 13.3944 8.88188ZM10.8538 6.14625C10.9002 6.19269 10.9371 6.24783 10.9623 6.30853C10.9874 6.36923 11.0004 6.43429 11.0004 6.5C11.0004 6.56571 10.9874 6.63077 10.9623 6.69147C10.9371 6.75217 10.9002 6.80731 10.8538 6.85375L7.35375 10.3538C7.30731 10.4002 7.25217 10.4371 7.19147 10.4623C7.13077 10.4874 7.06571 10.5004 7 10.5004C6.93429 10.5004 6.86923 10.4874 6.80853 10.4623C6.74783 10.4371 6.69269 10.4002 6.64625 10.3538L5.14625 8.85375C5.05243 8.75993 4.99972 8.63268 4.99972 8.5C4.99972 8.36732 5.05243 8.24007 5.14625 8.14625C5.24007 8.05243 5.36732 7.99972 5.5 7.99972C5.63268 7.99972 5.75993 8.05243 5.85375 8.14625L7 9.29313L10.1462 6.14625C10.1927 6.09976 10.2478 6.06288 10.3085 6.03772C10.3692 6.01256 10.4343 5.99961 10.5 5.99961C10.5657 5.99961 10.6308 6.01256 10.6915 6.03772C10.7522 6.06288 10.8073 6.09976 10.8538 6.14625Z" fill="black" fillOpacity="0.4" />
    </svg>
  );
}

function UnverifiedIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="0.75" />
      <path d="M7.5 5v3.5M7.5 11h0.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export default function MechanicDetailPanel({ mechanic, onClose, user, onEdit, onDelete, onRate, savedMechanics, onToggleSave, onDirection }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setActiveTab('Overview');
    setCollapsed(false);
  }, [mechanic?.id]);

  if (!mechanic) return null;

  const handleDirectionClick = () => {
    onDirection(mechanic);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) setCollapsed(true);
  };

  if (collapsed) {
    return (
      <div className="mechanic-detail-collapsed">
        <div className="detail-collapsed-info" onClick={() => setCollapsed(false)}>
          <h2 className="detail-collapsed-name">{mechanic.name}</h2>
          <p className="detail-collapsed-area">{mechanic.area}{mechanic.distance ? ` · ${mechanic.distance}` : ''}</p>
        </div>
        <div className="detail-collapsed-actions">
          {mechanic.phone && (
            <button
              className="detail-collapsed-call"
              aria-label="Call"
              onClick={() => { window.location.href = `tel:${mechanic.phone.replace(/\s+/g, '')}`; }}
            >
              <CallIcon size={16} />
            </button>
          )}
          <button className="detail-collapsed-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
      </div>
    );
  }

  const category = getCategory(mechanic.specialty);
  const hasProducts = (mechanic.products?.length || 0) > 0;
  const hasServices = (mechanic.services?.length || 0) > 0;

  const tabs = category === 'detailer'
    ? ['Overview', 'Packages', 'Reviews', 'Media']
    : category === 'fuel'
      ? ['Overview', 'Fuel Prices', 'Reviews', 'Media']
      : ['Overview', ...(hasProducts ? ['Products'] : []), ...(hasServices ? ['Services'] : []), 'Reviews', 'Media'];

  const isCreator = user && user.uid === mechanic.createdBy;

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "name": mechanic.name,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": mechanic.area,
      "addressCountry": "GH"
    },
    "telephone": mechanic.phone,
    "url": window.location.href
  };

  return (
    <>
      <div className="mechanic-detail-overlay" onClick={onClose}></div>
      <div className="mechanic-detail-panel">
        <Helmet>
          <title>{mechanic.name} - Mechanic in {mechanic.area} | Gears</title>
          <meta name="description" content={`Contact ${mechanic.name} in ${mechanic.area}. Specialty: ${mechanic.specialty || 'General Repairs'}. Call ${mechanic.phone}.`} />
          <script type="application/ld+json">
            {JSON.stringify(schemaMarkup)}
          </script>
        </Helmet>

        <button className="close-panel-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="detail-hero">
          <div className="detail-hero-avatar">
            <span className="detail-hero-avatar-letter">{mechanic.name.charAt(0).toUpperCase()}</span>
          </div>
          <h2 className="detail-hero-name">
            {mechanic.name}
            {(getVerificationTier(mechanic) === 1 || getVerificationTier(mechanic) === 2) && (
              <span className="detail-verify-icon">
                {getVerificationTier(mechanic) === 1 ? <VerifiedIcon size={16} /> : <ClaimedIcon size={16} />}
              </span>
            )}
          </h2>
          <p className="detail-hero-area">{mechanic.area}{mechanic.distance ? ` · ${mechanic.distance}` : ''}</p>

          {isCreator && (
            <div className="creator-actions">
              <button className="edit-btn" onClick={() => onEdit(mechanic)}><Pencil size={14} /> Edit</button>
              <button className="delete-btn" onClick={() => onDelete(mechanic)}><Trash size={14} /> Delete</button>
            </div>
          )}

          <div className="detail-tabs">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="detail-scroll">
          <div className="detail-content">
            {activeTab === 'Overview' && <OverviewTab mechanic={mechanic} category={category} onRate={onRate} />}
            {activeTab === 'Products' && <ListItemsTab mechanicId={mechanic.id} collectionName="products" user={user} itemName="Product" fallbackItems={mechanic.products} layout="grid" />}
            {activeTab === 'Services' && <ListItemsTab mechanicId={mechanic.id} collectionName="services" user={user} itemName="Service" fallbackItems={mechanic.services} layout="cards" />}
            {activeTab === 'Packages' && <ListItemsTab mechanicId={mechanic.id} collectionName="packages" user={user} itemName="Package" fallbackItems={mechanic.packages} />}
            {activeTab === 'Fuel Prices' && <FuelPricesTab fuelPrices={mechanic.fuelPrices} />}
            {activeTab === 'Media' && <MediaTab mechanicId={mechanic.id} user={user} fallbackMedia={mechanic.media} />}
            {activeTab === 'Reviews' && <ReviewsTab mechanicId={mechanic.id} mechanic={mechanic} fallbackReviews={mechanic.reviews} />}
          </div>
        </div>

        <div className="detail-bottom-bar">
          <div className="detail-bottom-left">
            <button className="bottom-icon-btn" onClick={() => onToggleSave(mechanic)} aria-label="Save">
              <BookmarkIcon size={20} state={savedMechanics.includes(mechanic.id) ? 'filled' : 'default'} color={savedMechanics.includes(mechanic.id) ? 'var(--forest)' : 'currentColor'} />
            </button>
            <button className="bottom-icon-btn" onClick={() => onRate(mechanic)} aria-label="Rate">
              <RateIcon size={20} />
            </button>
            <button className="bottom-icon-btn" aria-label="Share">
              <ShareIcon size={20} />
            </button>
            {/* <div className="detail-bottom-divider"></div> */}
          </div>

          <div className="detail-bottom-right">
            <button className="bottom-action-btn" onClick={handleDirectionClick}>
              <LocationIcon size={16} />
              <span className="card-action-label">Direction</span>
            </button>
            <button className="bottom-action-btn" onClick={() => window.location.href = `tel:${mechanic.phone.replace(/\s+/g, '')}`}>
              <CallIcon size={16} />
              <span>Call</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function OverviewTab({ mechanic, category, onRate }) {
  return (
    <div className="overview-tab">
      {category !== 'fuel' && (
        <div className="info-row">
          <HouseIcon size={16} />
          <div className="info-row-content">
            <span className="info-row-label">About</span>
            <p className="info-row-value info-row-value--sm">{mechanic.about || `Specialising in ${mechanic.specialty || 'general repairs'} for local and foreign vehicles.`}</p>
          </div>
        </div>
      )}

      <div className="info-row">
        <PinIcon size={16} />
        <div className="info-row-content">
          <span className="info-row-label">Location</span>
          <p className="info-row-value">{mechanic.locationDetail || mechanic.area}</p>
        </div>
      </div>

      <div className="info-row">
        <ClockIcon size={16} />
        <div className="info-row-content">
          <span className="info-row-label">Opening days</span>
          <p className="info-row-value">{mechanic.hours || (mechanic.open ? 'Open Now' : 'Closed')}</p>
        </div>
      </div>

      <div className="info-row">
        <PhoneIcon size={16} />
        <div className="info-row-content">
          <span className="info-row-label">Contact</span>
          <p className="info-row-value">{mechanic.phone || 'Not provided'}</p>
        </div>
      </div>

      {(category === 'fuel' ? mechanic.facilities : mechanic.specialties) && (category === 'fuel' ? mechanic.facilities : mechanic.specialties).length > 0 && (
        <div className="info-row">
          <Wrench size={16} weight="bold" />
          <div className="info-row-content">
            <span className="info-row-label">Specialities</span>
            <div className="specialty-tags">
              {(category === 'fuel' ? mechanic.facilities : mechanic.specialties).map(tag => (
                <span key={tag} className="specialty-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FuelPricesTab({ fuelPrices }) {
  if (!fuelPrices || fuelPrices.length === 0) {
    return <div className="tab-content"><p className="empty-tab-text">No fuel prices listed yet.</p></div>;
  }
  return (
    <div className="tab-content">
      <div className="fuel-price-list">
        {fuelPrices.map(f => (
          <div key={f.type} className="fuel-price-row">
            <span className="fuel-price-dot" style={{ background: f.color || 'var(--forest)' }}></span>
            <span className="fuel-price-name">{f.type}</span>
            <span className="fuel-price-value">GH₵{f.price}<span className="fuel-price-unit">/{f.unit}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsTab({ mechanicId, mechanic, fallbackReviews }) {
  const [reviews, setReviews] = useState(fallbackReviews || []);
  const [loading, setLoading] = useState(!!db);

  useEffect(() => {
    if (!db || !mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/ratings`), orderBy('ratedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [mechanicId]);

  if (loading) return <div className="tab-content"><p className="empty-tab-text">Loading reviews...</p></div>;

  const avg = mechanic.rating !== 'New' ? Number(mechanic.rating).toFixed(1) : null;
  const count = mechanic.ratingCount || 0;

  return (
    <div className="tab-content reviews-tab">
      {avg && (
        <div className="reviews-summary">
          <div className="reviews-summary-score">{avg}</div>
          <div className="reviews-summary-stars">
            {[...Array(5)].map((_, i) => (
              <StarRatingIcon key={i} size={16} state={i < Math.round(avg) ? 'filled' : 'default'} />
            ))}
          </div>
          <div className="reviews-summary-count">
            <span>{count}</span> <span className="reviews-summary-muted">verified reviews</span>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="empty-tab-text">No reviews yet. Be the first to rate!</p>
      ) : (
        <div className="reviews-list">
          {reviews.map((rev, i) => (
            <div key={rev.id || i} className="review-card">
              <div className="review-card-row">
                <div className="review-avatar">{rev.userName ? rev.userName.charAt(0).toUpperCase() : 'A'}</div>
                <div className="review-card-author">{rev.userName || 'Anonymous'}</div>
                <div className="review-stars">
                  {[...Array(rev.value || 0)].map((_, idx) => <StarRatingIcon key={`filled-${idx}`} size={12} state="filled" />)}
                  {[...Array(5 - (rev.value || 0))].map((_, idx) => <StarRatingIcon key={`empty-${idx}`} size={12} />)}
                </div>
              </div>
              {rev.comment && <p className="review-comment">{rev.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListItemsTab({ mechanicId, collectionName, user, itemName, fallbackItems, layout = 'list' }) {
  const [items, setItems] = useState(fallbackItems || []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db || !mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/${collectionName}`));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanicId, collectionName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !db) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `mechanics/${mechanicId}/${collectionName}`), {
        name: name.trim(),
        price: price.trim(),
        ...(layout === 'cards' && description.trim() ? { description: description.trim() } : {}),
        addedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      setName('');
      setPrice('');
      setDescription('');
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const isGrid = layout === 'grid';
  const isCards = layout === 'cards';

  return (
    <div className="tab-content">
      {user && db && (
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <button className="primary" onClick={() => setShowForm(!showForm)} style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Plus size={14} /> Add {itemName}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: '20px', padding: '16px', background: '#f4f5f1', borderRadius: '8px' }}>
          <input required placeholder={`${itemName} name`} value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', marginBottom: '8px', padding: '8px' }} />
          {isCards && (
            <input placeholder="Description (Optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', marginBottom: '8px', padding: '8px' }} />
          )}
          <input placeholder="Price (Optional)" value={price} onChange={e => setPrice(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px' }} />
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: '8px', padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </form>
      )}

      {items.length === 0 && !showForm && <p className="empty-tab-text">No {collectionName} listed yet.</p>}

      {isGrid ? (
        <div className="product-grid">
          {items.map((item, i) => (
            <ProductCard key={item.id || i} item={item} />
          ))}
        </div>
      ) : isCards ? (
        <div className="service-cards">
          {items.map((item, i) => (
            <div key={item.id || i} className="service-card">
              <div className="service-card-body">
                <h4 className="service-card-name">{item.name}</h4>
                {item.description && <p className="service-card-desc">{item.description}</p>}
              </div>
              {item.price && <span className="service-card-price">GH₵ {item.price}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="item-list">
          {items.map((item, i) => (
            <div key={item.id || i} className="item-row">
              <div className="item-row-main">
                <strong>{item.name}</strong>
                {item.description && <span className="item-row-description">{item.description}</span>}
              </div>
              <div className="item-row-side">
                {item.duration && <span className="item-row-duration">{item.duration}</span>}
                {item.price && <span className="item-row-price">GH₵{item.price}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PRODUCT_PLACEHOLDER_COLORS = [
  '#dcfce7', '#fefce8', '#f5d0fe', '#dbeafe', '#ffedd5',
  '#fce7f3', '#e0e7ff', '#ccfbf1', '#fef3c7', '#e0f2fe',
];

function hashToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRODUCT_PLACEHOLDER_COLORS[Math.abs(hash) % PRODUCT_PLACEHOLDER_COLORS.length];
}

function ProductCard({ item }) {
  return (
    <div className="product-card">
      <div
        className="product-card-image"
        style={{ background: item.imageUrl ? undefined : hashToColor(item.name || '') }}
      >
        {item.imageUrl && <img src={item.imageUrl} alt={item.name} />}
      </div>
      <div className="product-card-info">
        <h4 className="product-card-name">{item.name}</h4>
        {item.price && <p className="product-card-price">₵ {item.price}</p>}
      </div>
    </div>
  );
}

function MediaTab({ mechanicId, user, fallbackMedia }) {
  const [media, setMedia] = useState(fallbackMedia || []);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    if (!db || !mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/media`));
    const unsub = onSnapshot(q, (snap) => {
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanicId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim() || !db) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `mechanics/${mechanicId}/media`), {
        url: url.trim(),
        addedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      setUrl('');
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const categories = ['All', ...new Set(media.map(m => m.category).filter(Boolean))];
  const visibleMedia = activeCategory === 'All' ? media : media.filter(m => m.category === activeCategory);

  return (
    <div className="tab-content">
      {user && db && (
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <button className="primary" onClick={() => setShowForm(!showForm)} style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Plus size={14} /> Add Photo URL
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: '20px', padding: '16px', background: '#f4f5f1', borderRadius: '8px' }}>
          <input required type="url" placeholder="https://example.com/photo.jpg" value={url} onChange={e => setUrl(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px' }} />
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: '8px', padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </form>
      )}

      {media.length === 0 && !showForm && <p className="empty-tab-text">No media uploaded yet.</p>}

      {media.length > 0 && categories.length > 1 && (
        <div className="media-filter-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`media-filter-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="media-grid">
        {visibleMedia.map((m, i) => (
          <div key={m.id || i} className="media-tile" style={!m.url ? { background: m.color || '#eee' } : undefined}>
            {m.url ? (
              <img src={m.url} alt={m.label || 'Media'} onError={(e) => e.target.style.display = 'none'} />
            ) : (
              <span className="media-tile-label">{m.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
