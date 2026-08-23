import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Category glyphs — same silhouettes as the app's category icon components
// (./icons/MechanicIcon, ShopIcon, CarDetailingIcon, FillingStationIcon), just
// flattened to solid white since these render as a single-color glyph inside
// a colored circle avatar rather than the icons' usual tinted/multi-tone look.
const CATEGORY_GLYPH = {
  mechanic: '<svg viewBox="0 0 20 20" fill="white"><path d="M9.8101 5.3101C8.92009 5.3101 8.05006 5.57402 7.31004 6.06849C6.57001 6.56296 5.99324 7.26576 5.65264 8.08803C5.31205 8.91029 5.22294 9.81509 5.39657 10.688C5.5702 11.5609 5.99879 12.3627 6.62812 12.9921C7.25746 13.6214 8.05928 14.05 8.9322 14.2236C9.80511 14.3973 10.7099 14.3082 11.5322 13.9676C12.3544 13.627 13.0572 13.0502 13.5517 12.3102C14.0462 11.5701 14.3101 10.7001 14.3101 9.8101C14.3089 8.61701 13.8344 7.47314 12.9907 6.62949C12.1471 5.78585 11.0032 5.31134 9.8101 5.3101ZM9.8101 12.8101C9.21676 12.8101 8.63674 12.6342 8.14339 12.3045C7.65004 11.9749 7.26553 11.5063 7.03846 10.9582C6.8114 10.41 6.75199 9.80677 6.86775 9.22483C6.9835 8.64289 7.26922 8.10834 7.68878 7.68878C8.10834 7.26922 8.64289 6.9835 9.22483 6.86775C9.80677 6.75199 10.41 6.8114 10.9582 7.03846C11.5063 7.26553 11.9749 7.65004 12.3045 8.14339C12.6342 8.63674 12.8101 9.21676 12.8101 9.8101C12.8101 10.6058 12.494 11.3688 11.9314 11.9314C11.3688 12.494 10.6058 12.8101 9.8101 12.8101ZM18.0601 10.0126C18.0639 9.8776 18.0639 9.7426 18.0601 9.6076L19.4589 7.8601C19.5322 7.76835 19.583 7.66065 19.6071 7.54569C19.6312 7.43073 19.6279 7.31171 19.5976 7.19823C19.3679 6.33643 19.0249 5.5089 18.5776 4.73729C18.519 4.63634 18.4376 4.55046 18.34 4.4865C18.2423 4.42254 18.1311 4.38225 18.0151 4.36885L15.7914 4.12135C15.6989 4.02385 15.6051 3.9301 15.5101 3.8401L15.2476 1.61073C15.2341 1.49468 15.1937 1.38338 15.1295 1.28572C15.0654 1.18806 14.9794 1.10674 14.8782 1.04823C14.1067 0.601272 13.2791 0.258897 12.4173 0.0301014C12.3038 -0.000217189 12.1848 -0.00345701 12.0698 0.020643C11.9549 0.0447431 11.8472 0.0955092 11.7554 0.168851L10.0126 1.5601C9.8776 1.5601 9.7426 1.5601 9.6076 1.5601L7.8601 0.164164C7.76835 0.0908217 7.66065 0.0400557 7.54569 0.0159556C7.43073 -0.00814444 7.31171 -0.0049048 7.19823 0.0254138C6.33643 0.255127 5.5089 0.598117 4.73729 1.04541C4.63634 1.10403 4.55046 1.18541 4.4865 1.28306C4.42254 1.38071 4.38225 1.49195 4.36885 1.60791L4.12135 3.83541C4.02385 3.92854 3.9301 4.02229 3.8401 4.11666L1.61073 4.3726C1.49468 4.3861 1.38338 4.42653 1.28572 4.49066C1.18806 4.55479 1.10674 4.64085 1.04823 4.74198C0.601364 5.51369 0.258696 6.3412 0.0291639 7.20291C-0.0010265 7.31647 -0.00411435 7.43553 0.0201492 7.55049C0.0444127 7.66546 0.0953487 7.77312 0.168851 7.86479L1.5601 9.6076C1.5601 9.7426 1.5601 9.8776 1.5601 10.0126L0.164164 11.7601C0.0908217 11.8519 0.0400557 11.9595 0.0159556 12.0745C-0.00814444 12.1895 -0.0049048 12.3085 0.0254138 12.422C0.255127 13.2838 0.598117 14.1113 1.04541 14.8829C1.10403 14.9839 1.18541 15.0697 1.28306 15.1337C1.38071 15.1977 1.49195 15.238 1.60791 15.2514L3.83166 15.4989C3.92479 15.5964 4.01854 15.6901 4.11291 15.7801L4.3726 18.0095C4.3861 18.1255 4.42653 18.2368 4.49066 18.3345C4.55479 18.4321 4.64085 18.5135 4.74198 18.572C5.51369 19.0188 6.3412 19.3615 7.20291 19.591C7.31647 19.6212 7.43553 19.6243 7.55049 19.6001C7.66546 19.5758 7.77312 19.5249 7.86479 19.4514L9.6076 18.0601C9.7426 18.0639 9.8776 18.0639 10.0126 18.0601L11.7601 19.4589C11.8519 19.5322 11.9595 19.583 12.0745 19.6071C12.1895 19.6312 12.3085 19.6279 12.422 19.5976C13.2839 19.3683 14.1115 19.0253 14.8829 18.5776C14.9839 18.519 15.0697 18.4376 15.1337 18.34C15.1977 18.2423 15.238 18.1311 15.2514 18.0151L15.4989 15.7914C15.5964 15.6989 15.6901 15.6051 15.7801 15.5101L18.0095 15.2476C18.1255 15.2341 18.2368 15.1937 18.3345 15.1295C18.4321 15.0654 18.5135 14.9794 18.572 14.8782C19.0188 14.1065 19.3615 13.279 19.591 12.4173C19.6212 12.3037 19.6243 12.1847 19.6001 12.0697C19.5758 11.9547 19.5249 11.8471 19.4514 11.7554L18.0601 10.0126ZM16.5507 9.40323C16.5667 9.67424 16.5667 9.94596 16.5507 10.217C16.5396 10.4025 16.5977 10.5856 16.7139 10.7307L18.0442 12.3929C17.8915 12.878 17.6961 13.3486 17.4601 13.7992L15.3414 14.0392C15.1568 14.0596 14.9865 14.1478 14.8632 14.2867C14.6828 14.4896 14.4906 14.6818 14.2876 14.8623C14.1488 14.9855 14.0606 15.1559 14.0401 15.3404L13.8048 17.4573C13.3543 17.6934 12.8837 17.8888 12.3985 18.0414L10.7354 16.711C10.6023 16.6047 10.437 16.5468 10.2667 16.547H10.2217C9.95065 16.5629 9.67893 16.5629 9.40792 16.547C9.22243 16.5363 9.03954 16.5944 8.89417 16.7101L7.22729 18.0414C6.74216 17.8887 6.27156 17.6932 5.82104 17.4573L5.58104 15.3414C5.56056 15.1568 5.47237 14.9865 5.33354 14.8632C5.13058 14.6828 4.93837 14.4906 4.75791 14.2876C4.63466 14.1488 4.4643 14.0606 4.27979 14.0401L2.16291 13.8039C1.92684 13.3534 1.73138 12.8828 1.57885 12.3976L2.90916 10.7345C3.02533 10.5894 3.08346 10.4063 3.07229 10.2207C3.05635 9.94971 3.05635 9.67799 3.07229 9.40698C3.08346 9.22143 3.02533 9.03835 2.90916 8.89323L1.57885 7.22729C1.7315 6.74216 1.92696 6.27156 2.16291 5.82104L4.27885 5.58104C4.46337 5.56056 4.63373 5.47237 4.75698 5.33354C4.93744 5.13058 5.12964 4.93837 5.3326 4.75791C5.47199 4.63458 5.56054 4.46383 5.58104 4.27885L5.81635 2.16291C6.26682 1.92684 6.73743 1.73138 7.2226 1.57885L8.88573 2.90916C9.03085 3.02533 9.21393 3.08346 9.39948 3.07229C9.67049 3.05635 9.94221 3.05635 10.2132 3.07229C10.3987 3.08292 10.5816 3.02485 10.727 2.90916L12.3929 1.57885C12.878 1.7315 13.3486 1.92696 13.7992 2.16291L14.0392 4.27885C14.0596 4.46337 14.1478 4.63373 14.2867 4.75698C14.4896 4.93744 14.6818 5.12964 14.8623 5.3326C14.9855 5.47143 15.1559 5.55962 15.3404 5.5801L17.4573 5.81541C17.6934 6.26589 17.8888 6.7365 18.0414 7.22166L16.711 8.88479C16.5938 9.03113 16.5356 9.2161 16.5479 9.40323H16.5507Z" fill="white"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.9453 11.7542C16.3253 14.6886 20.6547 17.9304 21.0222 19.7736C21.2734 21.0298 20.3978 22.0723 19.2991 21.8736C18.0616 21.6504 18.0034 19.8692 18.4909 18.5004C19.7172 15.0542 20.1391 13.0648 19.7153 11.1973L19.5128 10.3198" stroke="white" stroke-width="0.9375" stroke-miterlimit="10"/><path d="M15.1541 10.5188C14.8035 10.5188 14.9404 10.2169 14.9404 9.84381V4.86006C14.9404 4.48693 14.8035 4.18506 15.1541 4.18506C15.5047 4.18506 16.1141 4.39318 16.1141 4.86006V9.84381C16.1141 10.2169 15.5047 10.5188 15.1541 10.5188Z" fill="white"/><path d="M15.3941 21.3619V5.2425C15.3941 2.76187 13.3822 0.75 10.9016 0.75H6.55531C4.07281 0.75 2.06281 2.76187 2.06281 5.2425V21.3619C1.44406 21.5438 0.992188 22.1156 0.992188 22.7925V22.8488C0.992188 23.07 1.17219 23.25 1.39344 23.25H16.0634C16.2847 23.25 16.4647 23.07 16.4647 22.8488V22.7925C16.4648 22.4704 16.3605 22.1569 16.1675 21.899C15.9745 21.6411 15.7031 21.4526 15.3941 21.3619Z" fill="white"/><path d="M12.3128 10.6071H5.04719C4.71531 10.6071 4.44531 10.3371 4.44531 10.0052V4.20393C4.44531 3.87205 4.71531 3.60205 5.04719 3.60205H12.3128C12.6447 3.60205 12.9147 3.87205 12.9147 4.20393V10.0033C12.9149 10.0825 12.8995 10.161 12.8694 10.2342C12.8393 10.3074 12.795 10.374 12.7391 10.4301C12.6832 10.4862 12.6167 10.5307 12.5436 10.5611C12.4704 10.5914 12.392 10.6071 12.3128 10.6071Z" fill="white"/><path d="M6.03906 5.5498H11.5347V6.9823H6.03906V5.5498ZM6.03906 7.7548H11.5347V9.1873H6.03906V7.7548Z" fill="white"/><path d="M4.52572 8.81248C4.51634 8.90998 4.37384 8.90998 4.36447 8.81436C4.22572 7.45123 4.14697 6.08623 4.08697 4.72311C3.99884 3.96936 4.58009 3.31873 5.35822 3.37123C7.56884 3.30561 9.79072 3.30561 12.0013 3.36936C12.7776 3.31686 13.3645 3.96748 13.2745 4.72123C13.2145 6.08623 13.1338 7.45311 12.9951 8.81811C12.9857 8.91561 12.8432 8.91561 12.8338 8.81811C12.6895 7.40623 12.6107 5.99248 12.547 4.58248C12.5446 4.5538 12.5389 4.52549 12.5301 4.49811C12.4832 4.32936 12.3201 4.18873 12.1513 4.20561C12.0613 4.20936 5.29259 4.20748 5.20634 4.20373C5.03759 4.18686 4.87447 4.32748 4.82759 4.49811C4.82009 4.52623 4.81447 4.55436 4.81072 4.58248C4.74697 5.99061 4.67009 7.40248 4.52572 8.81248Z" fill="white"/><path d="M8.67938 19.1194C10.418 19.1194 11.8275 17.6176 11.8275 15.765C11.8275 13.9124 10.418 12.4106 8.67938 12.4106C6.94071 12.4106 5.53125 13.9124 5.53125 15.765C5.53125 17.6176 6.94071 19.1194 8.67938 19.1194Z" fill="white"/><path d="M7.28906 16.2377C7.28906 15.4183 8.68219 13.8096 8.68219 13.8096C8.68219 13.8096 10.0753 15.4183 10.0753 16.2377C10.0753 17.0571 9.45094 17.7227 8.68219 17.7227C7.91344 17.7227 7.28906 17.0571 7.28906 16.2377Z" fill="white"/><path d="M2.0625 20.6309H15.3937V21.3602H2.0625V20.6309Z" fill="white"/><path d="M3.27344 4.13252C3.43844 3.20252 4.24844 2.05127 5.92281 2.05127" stroke="white" stroke-width="0.78125" stroke-miterlimit="10" stroke-linecap="round"/><path d="M20.2578 11.0589L19.1711 11.3349L18.992 10.6299L20.0786 10.3537L20.2578 11.0589ZM19.6409 5.59698L20.9028 3.30948C20.9966 3.14073 21.1203 2.99073 21.2684 2.86886C21.7297 2.49011 22.7628 1.63511 22.9803 1.39886C23.2634 1.09136 22.7384 0.442606 22.3653 0.699481C22.0728 0.901981 20.9966 1.84698 20.5484 2.24261C20.4172 2.35698 20.3084 2.49386 20.2241 2.64761L18.8984 5.05136L19.6409 5.59698Z" fill="white"/><path d="M18.8738 7.07439L20.64 6.70877L21.2625 8.92502C21.3619 9.31502 21.1819 9.42752 20.8369 9.51565L19.5881 9.86252M18.6094 6.9994L20.1188 10.44L21.5475 10.0406C22.1456 9.86627 22.1288 9.37877 22.0369 9.0169L21.3 6.31689L18.6094 6.9994Z" fill="white"/><path d="M19.4686 3.96004L20.3818 4.47379C20.5036 4.54129 20.5486 4.69317 20.4868 4.81692L20.3049 5.18067L20.7268 5.49942C21.0209 5.72086 21.2301 6.03659 21.3193 6.39379L21.3699 6.59067L20.0649 6.92629C19.9335 6.96108 19.8213 7.04652 19.7527 7.1639C19.6842 7.28127 19.665 7.42102 19.6993 7.55254L20.3011 9.92067C20.3611 10.1757 20.3761 10.3857 20.1193 10.4419L19.0786 10.7007C18.8311 10.755 18.5855 10.6032 18.5236 10.3575L17.7961 7.49067C17.4699 6.20629 17.9724 5.77129 18.0774 5.55942C18.1824 5.34754 18.7336 4.77004 18.7336 4.77004L19.1105 4.06504C19.1799 3.93567 19.3411 3.88879 19.4686 3.96004Z" fill="white"/><path d="M20.0228 5.50111L19.1172 5.04736" stroke="white" stroke-width="0.625" stroke-miterlimit="10" stroke-linecap="round"/></svg>',
  detailer: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.9671 13.8001H6.03906L7.17516 10.8856C7.35069 10.4354 7.65803 10.0487 8.05696 9.77601C8.4559 9.50335 8.92785 9.35745 9.41106 9.35742H14.5951C15.0783 9.35745 15.5502 9.50335 15.9492 9.77601C16.3481 10.0487 16.6554 10.4354 16.831 10.8856L17.9671 13.8001Z" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.10156 19.1621V20.8112C5.10156 20.9703 5.16478 21.123 5.2773 21.2355C5.38982 21.348 5.54243 21.4112 5.70156 21.4112H7.50156C7.66069 21.4112 7.8133 21.348 7.92583 21.2355C8.03835 21.123 8.10156 20.9703 8.10156 20.8112V19.1999H5.40156C5.29776 19.1995 5.19776 19.1869 5.10156 19.1621ZM15.9016 19.1999V20.8112C15.9016 20.9703 15.9648 21.123 16.0773 21.2355C16.1898 21.348 16.3424 21.4112 16.5016 21.4112H18.3016C18.4607 21.4112 18.6133 21.348 18.7258 21.2355C18.8383 21.123 18.9016 20.9703 18.9016 20.8112V19.1621C18.8054 19.1869 18.7054 19.1995 18.6016 19.1999H15.9016Z" fill="white"/><path d="M4.20312 16.2003C4.20312 15.5638 4.45598 14.9533 4.90607 14.5032C5.35616 14.0531 5.96661 13.8003 6.60313 13.8003H17.4031C18.0396 13.8003 18.6501 14.0531 19.1002 14.5032C19.5503 14.9533 19.8031 15.5638 19.8031 16.2003V18.0003C19.8031 18.3186 19.6767 18.6238 19.4517 18.8488C19.2266 19.0739 18.9214 19.2003 18.6031 19.2003H5.40313C5.08487 19.2003 4.77964 19.0739 4.5546 18.8488C4.32955 18.6238 4.20313 18.3186 4.20312 18.0003V16.2003Z" fill="white"/><path d="M8.10469 16.6114C8.10469 16.1144 7.70174 15.7114 7.20469 15.7114C6.70763 15.7114 6.30469 16.1144 6.30469 16.6114C6.30469 17.1085 6.70763 17.5114 7.20469 17.5114C7.70174 17.5114 8.10469 17.1085 8.10469 16.6114Z" fill="white"/><path d="M15.9031 16.6114C15.9031 16.1144 16.3061 15.7114 16.8031 15.7114C17.3002 15.7114 17.7031 16.1144 17.7031 16.6114C17.7031 17.1085 17.3002 17.5114 16.8031 17.5114C16.3061 17.5114 15.9031 17.1085 15.9031 16.6114Z" fill="white"/><path d="M6.38352 2.89271C6.4029 2.84988 6.43422 2.81355 6.47373 2.78806C6.51324 2.76258 6.55925 2.74902 6.60627 2.74902C6.65328 2.74902 6.6993 2.76258 6.7388 2.78806C6.77831 2.81355 6.80963 2.84988 6.82902 2.89271L6.97152 3.20861C7.08152 3.45161 7.20852 3.68541 7.35252 3.91001L7.75872 4.54421C7.8562 4.6964 7.91918 4.86807 7.94324 5.04719C7.96731 5.22631 7.95186 5.40853 7.898 5.58104C7.84414 5.75355 7.75316 5.91218 7.63145 6.04579C7.50975 6.17939 7.36027 6.28473 7.19352 6.35441L7.13892 6.37751C6.97016 6.44814 6.78905 6.48452 6.60612 6.48452C6.42318 6.48452 6.24207 6.44814 6.07332 6.37751L6.01872 6.35471C5.85192 6.28504 5.7024 6.17969 5.58066 6.04606C5.45893 5.91244 5.36793 5.75377 5.31406 5.58122C5.2602 5.40867 5.24477 5.22641 5.26886 5.04726C5.29295 4.86811 5.35598 4.69641 5.45352 4.54421L5.86002 3.91001C6.00402 3.68521 6.13092 3.45141 6.24072 3.20861L6.38352 2.89271ZM11.7835 2.89271C11.8029 2.84997 11.8343 2.81372 11.8737 2.78829C11.9132 2.76287 11.9592 2.74935 12.0061 2.74935C12.0531 2.74935 12.099 2.76287 12.1385 2.78829C12.178 2.81372 12.2093 2.84997 12.2287 2.89271L12.3715 3.20861C12.4815 3.45161 12.6085 3.68541 12.7525 3.91001L13.1587 4.54421C13.2562 4.6964 13.3192 4.86807 13.3432 5.04719C13.3673 5.22631 13.3519 5.40853 13.298 5.58104C13.2441 5.75355 13.1532 5.91218 13.0315 6.04579C12.9097 6.17939 12.7603 6.28473 12.5935 6.35441L12.5389 6.37751C12.3702 6.44814 12.1891 6.48452 12.0061 6.48452C11.8232 6.48452 11.6421 6.44814 11.4733 6.37751L11.4187 6.35471C11.2519 6.28504 11.1024 6.17969 10.9807 6.04606C10.8589 5.91244 10.7679 5.75377 10.7141 5.58122C10.6602 5.40867 10.6448 5.22641 10.6689 5.04726C10.6929 4.86811 10.756 4.69641 10.8535 4.54421L11.26 3.91001C11.404 3.68521 11.5309 3.45141 11.6407 3.20861L11.7835 2.89271ZM17.1835 2.89271C17.2029 2.84997 17.2343 2.81372 17.2737 2.78829C17.3132 2.76287 17.3592 2.74935 17.4061 2.74935C17.4531 2.74935 17.499 2.76287 17.5385 2.78829C17.578 2.81372 17.6093 2.84997 17.6287 2.89271L17.7715 3.20861C17.8815 3.45161 18.0085 3.68541 18.1525 3.91001L18.5587 4.54421C18.6562 4.6964 18.7192 4.86807 18.7432 5.04719C18.7673 5.22631 18.7519 5.40853 18.698 5.58104C18.6441 5.75355 18.5532 5.91218 18.4315 6.04579C18.3097 6.17939 18.1603 6.28473 17.9935 6.35441L17.9389 6.37751C17.7702 6.44814 17.5891 6.48452 17.4061 6.48452C17.2232 6.48452 17.0421 6.44814 16.8733 6.37751L16.8187 6.35471C16.6519 6.28504 16.5024 6.17969 16.3807 6.04606C16.2589 5.91244 16.1679 5.75377 16.1141 5.58122C16.0602 5.40867 16.0448 5.22641 16.0689 5.04726C16.093 4.86811 16.156 4.69641 16.2535 4.54421L16.66 3.91001C16.804 3.68521 16.9309 3.45141 17.0407 3.20861L17.1835 2.89271Z" fill="white"/></svg>',
  parts: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 6L19.86 12.2681C19.7972 12.6137 19.6151 12.9264 19.3454 13.1515C19.0758 13.3766 18.7357 13.4999 18.3844 13.5H6.61406L5.25 6H21Z" fill="white"/><path d="M21.5756 5.51906C21.5052 5.43481 21.4172 5.36705 21.3177 5.32056C21.2183 5.27407 21.1098 5.24998 21 5.25H5.87625L5.30625 2.11594C5.27485 1.94313 5.1838 1.78681 5.04897 1.67425C4.91414 1.56169 4.74408 1.50003 4.56844 1.5H2.25C2.05109 1.5 1.86032 1.57902 1.71967 1.71967C1.57902 1.86032 1.5 2.05109 1.5 2.25C1.5 2.44891 1.57902 2.63968 1.71967 2.78033C1.86032 2.92098 2.05109 3 2.25 3H3.9375L6.33375 16.1522C6.40434 16.5422 6.57671 16.9067 6.83344 17.2087C6.47911 17.5397 6.22336 17.9623 6.09455 18.4298C5.96575 18.8972 5.96892 19.3912 6.10371 19.8569C6.23851 20.3226 6.49966 20.7419 6.85821 21.0683C7.21676 21.3947 7.6587 21.6154 8.13502 21.7059C8.61134 21.7965 9.10344 21.7533 9.55673 21.5813C10.01 21.4092 10.4068 21.115 10.7031 20.7312C10.9994 20.3474 11.1836 19.889 11.2353 19.407C11.287 18.9249 11.2041 18.4379 10.9959 18H15.2541C15.0863 18.3513 14.9995 18.7357 15 19.125C15 19.6442 15.154 20.1517 15.4424 20.5834C15.7308 21.0151 16.1408 21.3515 16.6205 21.5502C17.1001 21.7489 17.6279 21.8008 18.1371 21.6996C18.6463 21.5983 19.114 21.3483 19.4812 20.9812C19.8483 20.614 20.0983 20.1463 20.1996 19.6371C20.3008 19.1279 20.2489 18.6001 20.0502 18.1205C19.8515 17.6408 19.5151 17.2308 19.0834 16.9424C18.6517 16.654 18.1442 16.5 17.625 16.5H8.54719C8.37155 16.5 8.20149 16.4383 8.06665 16.3257C7.93182 16.2132 7.84077 16.0569 7.80938 15.8841L7.51219 14.25H18.3872C18.9141 14.2499 19.4243 14.0649 19.8288 13.7272C20.2333 13.3896 20.5064 12.9206 20.6006 12.4022L21.7406 6.13406C21.7599 6.02572 21.7551 5.91447 21.7266 5.80818C21.6981 5.7019 21.6466 5.60319 21.5756 5.51906ZM9.75 19.125C9.75 19.3475 9.68402 19.565 9.5604 19.75C9.43679 19.935 9.26109 20.0792 9.05552 20.1644C8.84995 20.2495 8.62375 20.2718 8.40552 20.2284C8.18729 20.185 7.98684 20.0778 7.8295 19.9205C7.67217 19.7632 7.56502 19.5627 7.52162 19.3445C7.47821 19.1262 7.50049 18.9 7.58564 18.6945C7.67078 18.4889 7.81498 18.3132 7.99998 18.1896C8.18499 18.066 8.4025 18 8.625 18C8.92337 18 9.20952 18.1185 9.4205 18.3295C9.63147 18.5405 9.75 18.8266 9.75 19.125ZM18.75 19.125C18.75 19.3475 18.684 19.565 18.5604 19.75C18.4368 19.935 18.2611 20.0792 18.0555 20.1644C17.85 20.2495 17.6238 20.2718 17.4055 20.2284C17.1873 20.185 16.9868 20.0778 16.8295 19.9205C16.6722 19.7632 16.565 19.5627 16.5216 19.3445C16.4782 19.1262 16.5005 18.9 16.5856 18.6945C16.6708 18.4889 16.815 18.3132 17 18.1896C17.185 18.066 17.4025 18 17.625 18C17.9234 18 18.2095 18.1185 18.4205 18.3295C18.6315 18.5405 18.75 18.8266 18.75 19.125ZM19.125 12.1341C19.0935 12.3074 19.0021 12.464 18.8666 12.5766C18.7312 12.6893 18.5605 12.7506 18.3844 12.75H7.23938L6.14906 6.75H20.1009L19.125 12.1341Z" fill="white"/></svg>',
};

export function getMechanicCategory(specialty) {
  if (specialty === 'Car Detailing') return 'detailer';
  if (specialty === 'Fuel Station') return 'fuel';
  if (
    specialty === 'Shop' ||
    specialty === 'Parts Shop' ||
    specialty === 'Auto Parts' ||
    specialty === 'Car Parts'
  ) return 'parts';
  return 'mechanic';
}

const DEFAULT_LONGITUDE = -0.1870;
const DEFAULT_LATITUDE = 5.6037;
const DEFAULT_ZOOM = 15.95;
const MAX_MAP_ZOOM = 20;
const SELECT_ZOOM = 16;
const ROUTE_MAX_ZOOM = 16;
const TRANSITION_DURATION = 300;

function getCoordinate(value) {
  const coordinate = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(coordinate) ? coordinate : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Builds the same category pin (colored glyph avatar + name label) used
// everywhere on the real map — exported so other screens (e.g. the business
// location picker, before a listing has an id to cache against) can render
// an identical-looking marker without going through the id-keyed cache below.
export function buildCategoryMarkerIcon(category, name, selected = false) {
  const glyph = CATEGORY_GLYPH[category] || CATEGORY_GLYPH.mechanic;
  const safeName = escapeHtml(name || 'Gears');
  const selectedClass = selected ? ' category-marker-card--selected' : '';

  return L.divIcon({
    className: 'category-marker-icon',
    html: `
      <div class="category-marker-card category-marker-card--${category}${selectedClass}">
        <div class="category-marker-head">
          <div class="category-marker-avatar">${glyph}</div>
        </div>
        <div class="category-marker-dot"></div>
        <div class="category-marker-label">${safeName}</div>
      </div>
    `,
    iconSize: [190, 82],
    iconAnchor: [95, 48],
    popupAnchor: [0, -50],
  });
}

// Draggable/clickable pin using the same category marker as the real map —
// shared by the onboarding wizard's location step and the business
// dashboard's Map tab, so picking and later adjusting a location is the
// same component and the same visual pin in both places.
export function LocationPicker({ lat, lng, setLat, setLng, category, label, onInteract }) {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      onInteract?.();
    },
  });
  const icon = useMemo(
    () => buildCategoryMarkerIcon(getMechanicCategory(category), label),
    [category, label],
  );
  return lat && lng ? (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const pos = e.target.getLatLng();
          setLat(pos.lat);
          setLng(pos.lng);
          onInteract?.();
        },
      }}
    />
  ) : null;
}

// Memoized cache for marker icons — avoids recreating L.divIcon on every render
const iconCache = new Map();
function getCategoryIcon(mechanic, selected = false) {
  const key = `${mechanic.id}-${selected}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const category = getMechanicCategory(mechanic.specialty);
  const divIcon = buildCategoryMarkerIcon(category, mechanic.name, selected);

  iconCache.set(key, divIcon);
  return divIcon;
}

// Clear stale entries from the icon cache to prevent memory leaks
function pruneIconCache(activeIds) {
  const idSet = new Set(activeIds);
  for (const key of iconCache.keys()) {
    const id = key.split('-')[0];
    if (!idSet.has(id)) iconCache.delete(key);
  }
}

// Component to handle map centering when a mechanic is selected
function MapCenterer({ center, userLocation, mapPanTrigger, routeActive }) {
  const map = useMap();
  // Tracks which "Locate Me" tap we've already flown to, so the frequent
  // userLocation updates from the GPS watch don't keep re-triggering flyTo
  // (and resetting the zoom) every time the user tries to pan or zoom.
  const firedForTriggerRef = useRef(null);

  useEffect(() => {
    if (center && !routeActive) {
      map.flyTo(center, SELECT_ZOOM, { animate: true, duration: TRANSITION_DURATION / 1000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, routeActive]);

  useEffect(() => {
    if (mapPanTrigger <= 0 || !userLocation) return;
    if (firedForTriggerRef.current === mapPanTrigger) return;
    firedForTriggerRef.current = mapPanTrigger;
    map.flyTo([userLocation.lat, userLocation.lng], DEFAULT_ZOOM, { animate: true, duration: TRANSITION_DURATION / 1000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPanTrigger, userLocation]);

  return null;
}

function RouteFitter({ userLocation, routeTarget, routePath }) {
  const map = useMap();
  // Tracks which routeTarget we've already fit the view to, so the frequent
  // userLocation updates from the GPS watch don't keep yanking the camera
  // back to the route bounds every time the user tries to pan or zoom.
  const firedForKeyRef = useRef(null);

  useEffect(() => {
    if (!routeTarget) {
      firedForKeyRef.current = null;
      return;
    }
    if (!userLocation) return;

    const key = `${routeTarget.lat},${routeTarget.lng}`;
    if (firedForKeyRef.current === key) return;
    firedForKeyRef.current = key;

    const bounds = routePath && routePath.length > 0
      ? routePath
      : [[userLocation.lat, userLocation.lng], [routeTarget.lat, routeTarget.lng]];
    map.flyToBounds(bounds, { padding: [80, 80], duration: TRANSITION_DURATION / 1000, maxZoom: ROUTE_MAX_ZOOM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTarget, userLocation]);

  return null;
}

function MapZoomStyler() {
  const map = useMap();
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    const m = mapRef.current;
    const updateMarkerScale = () => {
      const zoom = m.getZoom();
      const scale = Math.min(1.24, Math.max(0.84, 0.9 + (zoom - 14) * 0.055));
      m.getContainer().style.setProperty('--map-marker-scale', scale.toFixed(2));
    };

    updateMarkerScale();
    m.on('zoomend', updateMarkerScale);
    return () => m.off('zoomend', updateMarkerScale);
  }, []);

  return null;
}

const UserLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div class="pulse"></div><div class="dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Radar-style scanning rings shown while "Use my location" is searching for nearby
// mechanics — mirrors the ripple effect ride-hailing apps use while finding drivers.
const UserLocationScanningIcon = L.divIcon({
  className: 'user-location-marker user-location-marker--scanning',
  html: '<div class="radar-ring radar-ring-1"></div><div class="radar-ring radar-ring-2"></div><div class="radar-ring radar-ring-3"></div><div class="pulse"></div><div class="dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// We use a single CARTO Voyager tile layer (with labels) instead of two separate
// layers (nolabels + only_labels), halving the tile requests.
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const TILE_SUBDOMAINS = 'abcd';
export const TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function MapLayout({ mechanics, selectedMechanic, onSelectMechanic, userLocation, mapPanTrigger, routeTarget, isLocatingScan }) {
  const defaultCenter = [DEFAULT_LATITUDE, DEFAULT_LONGITUDE];
  const [mapCenter, setMapCenter] = useState(null);
  const [routePath, setRoutePath] = useState(null);

  const mappedMechanics = useMemo(
    () => mechanics
      .map((m) => ({
        ...m,
        lat: getCoordinate(m.lat),
        lng: getCoordinate(m.lng),
      }))
      .filter((m) => m.lat !== null && m.lng !== null),
    [mechanics],
  );

  // Prune icon cache when mechanic set changes
  useEffect(() => {
    pruneIconCache(mappedMechanics.map((m) => m.id));
  }, [mappedMechanics]);

  useEffect(() => {
    const lat = getCoordinate(selectedMechanic?.lat);
    const lng = getCoordinate(selectedMechanic?.lng);
    if (lat !== null && lng !== null) {
      setMapCenter([lat, lng]);
    } else {
      // Clear so MapCenterer doesn't replay a stale center once routeActive
      // flips back to false after the detail panel closes.
      setMapCenter(null);
    }
  }, [selectedMechanic]);

  // Fetch the real road-network path between the user and the route target.
  // Debounced: only fires if userLocation + routeTarget stay stable for 150ms,
  // preventing rapid-fire API calls during map interaction.
  useEffect(() => {
    if (!userLocation || !routeTarget) {
      setRoutePath(null);
      return;
    }

    let cancelled = false;
    // Debounce — wait 150ms of stability before fetching
    const timer = setTimeout(() => {
      if (cancelled) return;
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${routeTarget.lng},${routeTarget.lat}?overview=full&geometries=geojson`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const coords = data?.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length > 0) {
            setRoutePath(coords.map(([lng, lat]) => [lat, lng]));
          } else {
            setRoutePath(null);
          }
        })
        .catch(() => {
          if (!cancelled) setRoutePath(null);
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userLocation, routeTarget]);

  // Memoize the marker elements to avoid recreating the array on every render
  const markerElements = useMemo(() =>
    mappedMechanics.map((m) => (
      <Marker
        key={m.id}
        position={[m.lat, m.lng]}
        icon={getCategoryIcon(m, selectedMechanic?.id === m.id)}
        zIndexOffset={selectedMechanic?.id === m.id ? 500 : 0}
        eventHandlers={{
          click: () => onSelectMechanic(m),
        }}
      >
        <Popup>
          <strong>{m.name}</strong><br />
          {m.area}
        </Popup>
      </Marker>
    )),
    [mappedMechanics, selectedMechanic?.id, onSelectMechanic],
  );

  const routeLinePositions = useMemo(() => {
    if (!userLocation || !routeTarget) return null;
    return routePath && routePath.length > 0
      ? routePath
      : [[userLocation.lat, userLocation.lng], [routeTarget.lat, routeTarget.lng]];
  }, [userLocation, routeTarget, routePath]);

  return (
    <div className="map-container-wrapper">
      <MapContainer
        center={defaultCenter}
        zoom={DEFAULT_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        minZoom={12}
        style={{ height: '100vh', width: '100%', zIndex: 0 }}
        zoomControl={false}
        wheelDebounceTime={80}
        zoomSnap={0.5}
        fadeAnimation={true}
        zoomAnimation={true}
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
          subdomains={TILE_SUBDOMAINS}
          maxNativeZoom={18}
          maxZoom={MAX_MAP_ZOOM}
          updateWhenZooming={false}
          updateWhenIdle={true}
          updateInterval={200}
          keepBuffer={2}
        />

        <MapCenterer center={mapCenter} userLocation={userLocation} mapPanTrigger={mapPanTrigger} routeActive={!!routeTarget} />
        <MapZoomStyler />
        <RouteFitter userLocation={userLocation} routeTarget={routeTarget} routePath={routePath} />

        {routeLinePositions && (
          <Polyline
            positions={routeLinePositions}
            pathOptions={{ color: '#155e42', weight: 4, opacity: 0.85, lineCap: 'round' }}
          />
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={isLocatingScan ? UserLocationScanningIcon : UserLocationIcon}
            zIndexOffset={1000}
          />
        )}

        {markerElements}
      </MapContainer>
    </div>
  );
}
