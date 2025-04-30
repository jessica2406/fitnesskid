// app/(tabs)/tests/[id].tsx - FINAL COMPLETE VERSION

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
// --- Firestore/Auth Imports ---
import { collection, addDoc, serverTimestamp, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext'; // Adjust path if needed
import { db } from '../../../firebaseConfig'; // Adjust path if needed

// -----------------------------

// --- Norms Data Structure & Helper Functions ---
type NormCondition =
  | { type: 'lessThan'; value: number }
  | { type: 'lessThanOrEqual'; value: number }
  | { type: 'greaterThan'; value: number }
  | { type: 'greaterThanOrEqual'; value: number }
  | { type: 'range'; min: number; max: number }
  | { type: 'exact'; value: number };

type NormEntry = {
  rating: string;
  condition: NormCondition;
};

type GenderNorms = {
  male?: NormEntry[];
  female?: NormEntry[];
  any?: NormEntry[];
};

type AgeGenderNorms = {
  [ageRange: string]: GenderNorms;
};

const checkCondition = (value: number, condition: NormCondition): boolean => {
  switch (condition.type) {
    case 'lessThan': return value < condition.value;
    case 'lessThanOrEqual': return value <= condition.value;
    case 'greaterThan': return value > condition.value;
    case 'greaterThanOrEqual': return value >= condition.value;
    case 'range': return value >= condition.min && value <= condition.max;
    case 'exact': return value === condition.value;
    default: return false;
  }
};

const getRatingFromNorms = (value: number, norms: NormEntry[] | undefined): string => {
  if (!norms) return 'Norms not available';
  for (const norm of norms) {
    if (checkCondition(value, norm.condition)) {
      return norm.rating;
    }
  }
  return 'Rating Undefined';
};

const getAgeRangeKey = (age: number, ageGroups: string[]): string | null => {
    for (const range of ageGroups) {
        if (range.includes('+')) {
             const minAge = parseInt(range.replace('+', ''), 10);
             if (!isNaN(minAge) && age >= minAge) return range;
        } else if (range.includes('-')) {
            const parts = range.split('-');
            const minAge = parseInt(parts[0], 10);
            const maxAgeStr = parts[1].replace(/yrs/i, '');
            const maxAge = parseInt(maxAgeStr, 10);
            if (!isNaN(minAge) && !isNaN(maxAge) && age >= minAge && age <= maxAge) {
                return range;
            }
        } else if (range.includes('yrs')) {
             const singleAge = parseInt(range.replace('yrs', ''), 10);
             if (!isNaN(singleAge) && age === singleAge) return range;
        }
    }
     for (const range of ageGroups) {
        if (range.includes('-')) {
             const parts = range.split('-');
             const minAge = parseInt(parts[0], 10);
             const maxAge = parseInt(parts[1], 10);
             if (!isNaN(minAge) && !isNaN(maxAge) && age >= minAge && age <= maxAge) {
                 return range;
            }
        }
     }
    return null;
}
const parseTimeToSeconds = (timeString: string): number => {
  const parts = String(timeString).split('.');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (isNaN(minutes) || isNaN(seconds)) {
      console.warn(`Invalid time format encountered: ${timeString}`);
      return Infinity; // Return a very large number for invalid formats
  }
  // Handle times like "6.03" correctly -> 6 minutes and 3 seconds
  return minutes * 60 + seconds;
};

// Helper function to determine rating based on percentile for 1.6km run
const getRatingFromPercentile = (
  userTotalSeconds: number,
  gender: string,
  age: number,
  normsData: TestDetails['norms']
): string => {

  if (!normsData?.boys || !normsData?.girls) return 'Norms data missing';

  // 1. Select correct age column key
  let ageKey = `${age}yrs`;
  if (age >= 17) {
      ageKey = '17+';
  } else if (!normsData.boys[ageKey] && !normsData.girls[ageKey]) { // Check if age key exists
       // Try finding nearest age range if exact isn't present (more complex)
       // For now, return error if exact age not found (except 17+)
       console.warn(`No percentile data found for age: ${age}`);
       return 'Norms not available for age';
  }

  // 2. Select gender table
  const genderTable = gender === 'male' ? normsData.boys : normsData.girls;
  if (!genderTable) return 'Norms not available for gender';

  // 3. Get the data for the specific age
  const ageColumnData = genderTable[ageKey];
  if (!ageColumnData || ageColumnData.length === 0) {
      console.warn(`No percentile data found for gender: ${gender}, age key: ${ageKey}`);
      return 'Norms not available for age/gender';
  }

  // 4. Define Percentile Bands for Ratings (EXAMPLE - ADJUST THESE!)
  const percentileBands = [
      { rating: 'Excellent', minPercentile: 90 },
      { rating: 'Very Good', minPercentile: 80 },
      { rating: 'Good', minPercentile: 70 },
      { rating: 'Above Average', minPercentile: 60 },
      { rating: 'Average', minPercentile: 40 }, // Wider average band often used
      { rating: 'Below Average', minPercentile: 30 },
      { rating: 'Fair', minPercentile: 20 },
      { rating: 'Poor', minPercentile: 10 },
      { rating: 'Very Poor', minPercentile: 0 }, // Catch all below 10
  ];

  // 5. Find the percentile
  // Iterate DESCENDING percentile order (lowest time first)
  for (const entry of ageColumnData) {
      // Lower time is better (higher percentile)
      if (userTotalSeconds <= entry.timeSeconds) {
          // User's time is as good as or better than this percentile's time
          // Now find which rating band this percentile falls into
           for (const band of percentileBands) {
               if (entry.percentile >= band.minPercentile) {
                   return band.rating; // Return the first band matched
               }
           }
           // Should theoretically not be reached if bands cover 0-100
           return 'Rating Band Undefined';
      }
  }

  // If user's time is slower than the 0th percentile time
  return 'Very Poor';
};
// --- End Helpers ---


// --- Test Data Definition ---
interface TestInput {
  label: string;
  key: string;
  type: 'numeric' | 'text' | 'gender' | 'age';
  unit?: string;
}

interface TestDetails {
  title: string;
  description: string;
  instructions: string[];
  inputs: TestInput[];
  pointsMapping: Record<string, number>; // Maps rating string to points
  formula?: string;
  resultUnit?: string;
  resultType: 'rating' | 'value' | 'value_and_rating';
  norms?: GenderNorms | AgeGenderNorms;
}

// --- EXAMPLE Points Mapping (!!! REVIEW AND ADJUST THESE VALUES !!!) ---
const defaultPoints_100_Scale = { Excellent: 100, 'Very Good': 90, 'Above Average': 80, Good: 70, Average: 60, Fair: 50, 'Below Average': 40, Poor: 30, 'Very Poor': 20, Super: 110, 'Rating Undefined': 0, 'Norms not available': 0 };
const defaultPoints_75_Scale = { Excellent: 75, 'Very Good': 65, 'Above Average': 55, Good: 45, Average: 35, Fair: 30, 'Below Average': 25, Poor: 20, 'Very Poor': 15, Super: 80, 'Rating Undefined': 0, 'Norms not available': 0 };
const defaultPoints_50_Scale = { Excellent: 50, Good: 40, 'Above Average': 35, Average: 30, 'Below Average': 25, Fair: 20, Poor: 15, 'Very Poor': 10, Super: 55, 'Rating Undefined': 0, 'Norms not available': 0 };
const defaultPoints_30_Scale = { Excellent: 30, 'Very Good': 27, Good: 24, Average: 20, Fair: 16, Poor: 12, 'Very Poor': 8, Super: 35, 'Rating Undefined': 0, 'Norms not available': 0 };
const bmiPoints = { Underweight: 10, Normal: 20, Overweight: 10, Obese: 5, 'Rating Undefined': 0, 'Norms not available': 0 };
// -----------------------------------------------------------------

// --- Full Test Data Object ---
const testData: Record<string, TestDetails> = {
  queens: {
    title: "Queen's College Step Test",
    pointsMapping: { 'Excellent': 100, 'Above Average': 80, 'Average': 60, 'Below Average': 40, 'Poor': 20, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Estimate VO₂ max by measuring heart rate after a 3-minute step test.',
    instructions: [
      // Integrate equipment info here as a non-numbered preliminary step/note
      'Equipment required: Metronome (88bpm females / 96bpm males), Step/bench (41.3cm/16.5 inches), Stopwatch.',
      // Numbered procedure steps from the image:
      'The participant completes a thorough warm up.',
      'The assistant gives the \'go\' signal while the participant commences stepping onto the bench using a "up-up-down-down" rhythm.', // Escaped single quote
      'The participant stays in time with the metronome and stops at the completion of 3 minutes.',
      'Immediately following the 3 minutes, the participant locates their pulse.',
      'When the participant locates their pulse, the assistant starts the stopwatch for 30 seconds while the participant counts their heart beat.', // Corrected typo "pluse"
      'The participant doubles their heart beat result to get their BPM.', // Separated calculation for clarity
      // Add reference note at the end
      'Compare the calculated BPM to the norms found in the "Queens Step Test Norms" document.' // Integrated reference note
    ],
    inputs: [
      { label: 'Gender (male/female)', key: 'gender', type: 'gender' },
      { label: 'Heart Rate (BPM)', key: 'hr', type: 'numeric' },
    ],
    formula: 'Male: VO₂ max = 111.33 - (0.42 × HR)\nFemale: VO₂ max = 65.81 - (0.1847 × HR)',
    resultUnit: 'ml/kg/min',
    resultType: 'value_and_rating',
    norms: {
      male: [
        { rating: 'Excellent', condition: { type: 'lessThan', value: 120 } },
        { rating: 'Above Average', condition: { type: 'range', min: 121, max: 148 } },
        { rating: 'Average', condition: { type: 'range', min: 149, max: 156 } },
        { rating: 'Below Average', condition: { type: 'range', min: 157, max: 162 } },
        { rating: 'Poor', condition: { type: 'greaterThanOrEqual', value: 163 } },
      ],
      female: [
        { rating: 'Excellent', condition: { type: 'lessThan', value: 129 } },
        { rating: 'Above Average', condition: { type: 'range', min: 129, max: 158 } },
        { rating: 'Average', condition: { type: 'range', min: 159, max: 166 } },
        { rating: 'Below Average', condition: { type: 'range', min: 167, max: 170 } },
        { rating: 'Poor', condition: { type: 'greaterThanOrEqual', value: 171 } },
      ],
    },
  },
  beep: {
    title: '20m Shuttle Run (Beep Test)',
    pointsMapping: { 'Excellent': 100, 'Very Good': 85, 'Good': 70, 'Average': 55, 'Fair': 40, 'Poor': 25, 'Very Poor': 10, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Progressive aerobic cardiovascular endurance test (VO₂ max estimate).',
    instructions: [
      // Integrate equipment info here as a non-numbered preliminary step/note
      'Equipment required: Cones, tape measure, and audio cues for the 20m shuttle run on CD, Tape or MP3.',
      // Numbered procedure steps from the image:
      'Measure out and mark a 20m section on a flat surface with cones.',
      'Begin playback of shuttle run audio.',
      'Participants commence running between the sets of cones, turning when signalled by the beeps. This process continues as the beeps become closer together, ultimately increasing the speed of the runner.',
      'If the line is reached before the beep sounds, the participant must wait until the beep.',
      'The test is stopped if the participant fails to reach the line for two consecutive runs and their shuttle level is recorded.',
      // Add reference note at the end
      'Refer to the "20m Shuttle Run" document for norms and scoring.'
    ],
    inputs: [
      { label: 'Age', key: 'age', type: 'age'},
      { label: 'Gender (male/female)', key: 'gender', type: 'gender' },
      { label: 'Final Level Reached', key: 'level', type: 'numeric' },
    ],
    resultType: 'rating',
    norms: {
      "12-13yrs": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 10.9 } }, { rating: 'Very Good', condition: { type: 'range', min: 8.9, max: 10.8 } }, { rating: 'Good', condition: { type: 'range', min: 7.6, max: 8.8 } }, { rating: 'Average', condition: { type: 'range', min: 6.5, max: 7.5 } }, { rating: 'Fair', condition: { type: 'range', min: 5.2, max: 6.4 } }, { rating: 'Poor', condition: { type: 'range', min: 3.4, max: 5.1 } }, { rating: 'Very Poor', condition: { type: 'lessThanOrEqual', value: 3.3 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 9.3 } }, { rating: 'Very Good', condition: { type: 'range', min: 7.5, max: 9.2 } }, { rating: 'Good', condition: { type: 'range', min: 6.2, max: 7.4 } }, { rating: 'Average', condition: { type: 'range', min: 5.2, max: 6.1 } }, { rating: 'Fair', condition: { type: 'range', min: 3.6, max: 5.1 } }, { rating: 'Poor', condition: { type: 'range', min: 2.6, max: 3.5 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 2.6 } }, ] },
      "14-15yrs": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 12.2 } }, { rating: 'Very Good', condition: { type: 'range', min: 9.9, max: 12.1 } }, { rating: 'Good', condition: { type: 'range', min: 8.10, max: 9.8 } }, { rating: 'Average', condition: { type: 'range', min: 7.5, max: 8.0 } }, { rating: 'Fair', condition: { type: 'range', min: 6.2, max: 7.4 } }, { rating: 'Poor', condition: { type: 'range', min: 4.7, max: 6.1 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 4.7 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 10.7 } }, { rating: 'Very Good', condition: { type: 'range', min: 8.8, max: 10.6 } }, { rating: 'Good', condition: { type: 'range', min: 7.6, max: 8.7 } }, { rating: 'Average', condition: { type: 'range', min: 6.5, max: 7.5 } }, { rating: 'Fair', condition: { type: 'range', min: 5.3, max: 6.4 } }, { rating: 'Poor', condition: { type: 'range', min: 3.4, max: 5.2 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 3.3 } }, ] },
      "16-17yrs": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 13.7 } }, { rating: 'Very Good', condition: { type: 'range', min: 11.4, max: 13.6 } }, { rating: 'Good', condition: { type: 'range', min: 9.10, max: 11.3 } }, { rating: 'Average', condition: { type: 'range', min: 8.3, max: 9.0 } }, { rating: 'Fair', condition: { type: 'range', min: 6.9, max: 8.2 } }, { rating: 'Poor', condition: { type: 'range', min: 5.1, max: 6.8 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 5.1 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 11.11 } }, { rating: 'Very Good', condition: { type: 'range', min: 9.8, max: 11.10 } }, { rating: 'Good', condition: { type: 'range', min: 8.5, max: 9.7 } }, { rating: 'Average', condition: { type: 'range', min: 7.2, max: 8.4 } }, { rating: 'Fair', condition: { type: 'range', min: 5.7, max: 7.1 } }, { rating: 'Poor', condition: { type: 'range', min: 4.2, max: 5.6 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 4.2 } }, ] },
      "18-25yrs": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 13.10 } }, { rating: 'Very Good', condition: { type: 'range', min: 11.6, max: 13.0 } }, { rating: 'Good', condition: { type: 'range', min: 10.2, max: 11.5 } }, { rating: 'Average', condition: { type: 'range', min: 8.6, max: 10.1 } }, { rating: 'Fair', condition: { type: 'range', min: 7.2, max: 8.5 } }, { rating: 'Poor', condition: { type: 'range', min: 5.2, max: 7.1 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 5.2 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 12.7 } }, { rating: 'Very Good', condition: { type: 'range', min: 10.2, max: 12.6 } }, { rating: 'Good', condition: { type: 'range', min: 8.7, max: 10.1 } }, { rating: 'Average', condition: { type: 'range', min: 7.3, max: 8.6 } }, { rating: 'Fair', condition: { type: 'range', min: 5.8, max: 7.2 } }, { rating: 'Poor', condition: { type: 'range', min: 4.5, max: 5.7 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 4.5 } }, ] }
    },
  },
  '1-6km': {
    title: '1.6km Run Test',
    pointsMapping: { // Define points for percentile ratings - EXAMPLE VALUES
        'Excellent': 100, // e.g., >= 90th percentile
        'Very Good': 90,  // e.g., 80-89th
        'Good': 80,       // e.g., 70-79th
        'Above Average': 70, // e.g., 60-69th
        'Average': 60,    // e.g., 40-59th
        'Below Average': 50, // e.g., 30-39th
        'Fair': 40,       // e.g., 20-29th
        'Poor': 30,       // e.g., 10-19th
        'Very Poor': 20,  // e.g., < 10th
        'Rating Undefined': 0,
        'Norms not available': 0
    },
    description: 'Measure cardiovascular endurance by running 1.6km (1 mile) as fast as possible.',
    instructions: [
      // Equipment note
      'Equipment required: A measured running track (e.g., a 400m track).',
      // Procedure steps as plain sentences
      'Complete a thorough warm up and dynamic stretches.',
      'Participants line up at the start of the measured track.',
      'On the start signal, participants must run the 1.6km as fast as possible.',
      'The faster the time to complete, the greater your aerobic capacity.', // Note from original step 3
      'Complete a thorough warm down and static stretching after finishing the run.',
      // Reference note
    ],
    inputs: [ { label: 'Age', key: 'age', type: 'age' }, { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Minutes', key: 'min', type: 'numeric' }, { label: 'Seconds', key: 'sec', type: 'numeric' }, ],
    resultType: 'rating', // Result will be the percentile-based rating
    resultUnit: 'rating', // Indicate the unit is a rating
    norms: {
        // Data ordered by percentile DESCENDING (highest first) for easier comparison
        // Times are converted to total seconds
        boys: {
            '12yrs': [
                { percentile: 100, timeSeconds: parseTimeToSeconds('6.03') },
                { percentile: 95, timeSeconds: parseTimeToSeconds('6.43') },
                { percentile: 90, timeSeconds: parseTimeToSeconds('6.57') },
                { percentile: 85, timeSeconds: parseTimeToSeconds('7.11') },
                { percentile: 80, timeSeconds: parseTimeToSeconds('7.25') },
                { percentile: 75, timeSeconds: parseTimeToSeconds('7.41') },
                { percentile: 70, timeSeconds: parseTimeToSeconds('7.56') },
                { percentile: 65, timeSeconds: parseTimeToSeconds('8.05') },
                { percentile: 60, timeSeconds: parseTimeToSeconds('8.14') },
                { percentile: 55, timeSeconds: parseTimeToSeconds('8.25') },
                { percentile: 50, timeSeconds: parseTimeToSeconds('8.40') },
                { percentile: 45, timeSeconds: parseTimeToSeconds('8.58') },
                { percentile: 40, timeSeconds: parseTimeToSeconds('9.11') },
                { percentile: 35, timeSeconds: parseTimeToSeconds('9.40') },
                { percentile: 30, timeSeconds: parseTimeToSeconds('10.00') },
                { percentile: 25, timeSeconds: parseTimeToSeconds('10.22') },
                { percentile: 20, timeSeconds: parseTimeToSeconds('10.52') },
                { percentile: 15, timeSeconds: parseTimeToSeconds('11.30') },
                { percentile: 10, timeSeconds: parseTimeToSeconds('12.11') },
                { percentile: 5, timeSeconds: parseTimeToSeconds('13.14') },
                { percentile: 0, timeSeconds: parseTimeToSeconds('23.05') }
            ],
            '13yrs': [
                { percentile: 100, timeSeconds: parseTimeToSeconds('5.40') },
                { percentile: 95, timeSeconds: parseTimeToSeconds('6.25') },
                { percentile: 90, timeSeconds: parseTimeToSeconds('6.39') },
                { percentile: 85, timeSeconds: parseTimeToSeconds('6.50') },
                { percentile: 80, timeSeconds: parseTimeToSeconds('7.00') },
                { percentile: 75, timeSeconds: parseTimeToSeconds('7.11') },
                { percentile: 70, timeSeconds: parseTimeToSeconds('7.20') },
                { percentile: 65, timeSeconds: parseTimeToSeconds('7.29') },
                { percentile: 60, timeSeconds: parseTimeToSeconds('7.41') },
                { percentile: 55, timeSeconds: parseTimeToSeconds('7.55') },
                { percentile: 50, timeSeconds: parseTimeToSeconds('8.06') },
                { percentile: 45, timeSeconds: parseTimeToSeconds('8.17') },
                { percentile: 40, timeSeconds: parseTimeToSeconds('8.35') },
                { percentile: 35, timeSeconds: parseTimeToSeconds('8.54') },
                { percentile: 30, timeSeconds: parseTimeToSeconds('9.10') },
                { percentile: 25, timeSeconds: parseTimeToSeconds('9.23') },
                { percentile: 20, timeSeconds: parseTimeToSeconds('10.02') },
                { percentile: 15, timeSeconds: parseTimeToSeconds('10.39') },
                { percentile: 10, timeSeconds: parseTimeToSeconds('11.43') },
                { percentile: 5, timeSeconds: parseTimeToSeconds('12.47') },
                { percentile: 0, timeSeconds: parseTimeToSeconds('24.12') }
            ],
            '14yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('4.30') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('6.01') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('6.13') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('6.26') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('6.33') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('6.45') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('6.59') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('7.09') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('7.19') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('7.29') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('7.44') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('7.59') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('8.13') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('8.30') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('8.48') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('9.10') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('9.35') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('10.18') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('11.22') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('12.11') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('18.10') }
            ],
             '15yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('4.42') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('5.50') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('6.07') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('6.20') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('6.29') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('6.38') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('6.48') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('6.57') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('7.06') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('7.16') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('7.30') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('7.39') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('7.52') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('8.08') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('8.29') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('8.49') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('9.05') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('9.34') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('10.10') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('11.25') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('21.44') }
            ],
             '16yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('4.49') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('5.40') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('5.56') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('6.08') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('6.18') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('6.25') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('6.33') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('6.44') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('6.50') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('6.58') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('7.10') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('7.20') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('7.35') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('7.53') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('8.09') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('8.37') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('8.56') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('9.22') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('10.17') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('11.49') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('20.15') }
            ],
             '17+': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('4.46') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('5.35') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('5.57') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('6.06') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('6.14') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('6.23') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('6.32') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('6.40') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('6.50') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('6.57') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('7.04') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('7.14') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('7.24') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('7.35') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('7.52') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('8.06') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('8.25') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('8.56') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('9.23') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('10.15') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('16.49') }
            ]
        },
        girls: {
             '12yrs': [
                { percentile: 100, timeSeconds: parseTimeToSeconds('6.22') },
                { percentile: 95, timeSeconds: parseTimeToSeconds('7.35') },
                { percentile: 90, timeSeconds: parseTimeToSeconds('8.00') },
                { percentile: 85, timeSeconds: parseTimeToSeconds('8.23') },
                { percentile: 80, timeSeconds: parseTimeToSeconds('8.52') },
                { percentile: 75, timeSeconds: parseTimeToSeconds('9.15') },
                { percentile: 70, timeSeconds: parseTimeToSeconds('9.36') },
                { percentile: 65, timeSeconds: parseTimeToSeconds('10.05') },
                { percentile: 60, timeSeconds: parseTimeToSeconds('10.26') },
                { percentile: 55, timeSeconds: parseTimeToSeconds('10.44') },
                { percentile: 50, timeSeconds: parseTimeToSeconds('11.05') },
                { percentile: 45, timeSeconds: parseTimeToSeconds('11.23') },
                { percentile: 40, timeSeconds: parseTimeToSeconds('11.47') },
                { percentile: 35, timeSeconds: parseTimeToSeconds('12.01') },
                { percentile: 30, timeSeconds: parseTimeToSeconds('12.24') },
                { percentile: 25, timeSeconds: parseTimeToSeconds('12.46') },
                { percentile: 20, timeSeconds: parseTimeToSeconds('13.35') },
                { percentile: 15, timeSeconds: parseTimeToSeconds('14.12') },
                { percentile: 10, timeSeconds: parseTimeToSeconds('14.39') },
                { percentile: 5, timeSeconds: parseTimeToSeconds('16.00') },
                { percentile: 0, timeSeconds: parseTimeToSeconds('24.54') }
            ],
            '13yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('5.42') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('7.21') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('7.49') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('8.13') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('8.29') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('8.49') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('9.09') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('9.30') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('9.50') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('10.07') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('10.23') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('10.57') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('11.20') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('11.40') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('12.00') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('12.29') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('13.01') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('14.10') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('14.49') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('16.10') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('20.45') }
            ],
             '14yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('5.00') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('7.20') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('7.43') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('7.59') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('8.20') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('8.36') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('8.50') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('9.09') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('9.27') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('9.51') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('10.06') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('10.25') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('10.51') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('11.10') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('11.36') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('11.52') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('12.18') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('12.56') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('14.10') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('15.44') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('20.04') }
            ],
             '15yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('5.51') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('7.25') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('7.52') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('8.08') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('8.24') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('8.40') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('8.55') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('9.09') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('9.23') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('9.37') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('9.58') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('10.18') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('10.40') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('11.00') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('11.20') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('11.48') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('12.19') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('13.33') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('14.13') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('15.17') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('24.07') }
            ],
             '16yrs': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('5.58') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('7.26') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('7.55') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('8.23') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('8.39') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('8.50') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('9.11') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('9.25') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('9.48') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('10.09') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('10.31') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('10.58') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('11.15') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('11.44') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('12.08') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('12.42') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('13.23') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('14.16') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('16.03') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('18.00') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('21.00') }
            ],
             '17+': [
                 { percentile: 100, timeSeconds: parseTimeToSeconds('6.20') },
                 { percentile: 95, timeSeconds: parseTimeToSeconds('7.22') },
                 { percentile: 90, timeSeconds: parseTimeToSeconds('7.58') },
                 { percentile: 85, timeSeconds: parseTimeToSeconds('8.15') },
                 { percentile: 80, timeSeconds: parseTimeToSeconds('8.34') },
                 { percentile: 75, timeSeconds: parseTimeToSeconds('8.52') },
                 { percentile: 70, timeSeconds: parseTimeToSeconds('9.15') },
                 { percentile: 65, timeSeconds: parseTimeToSeconds('9.33') },
                 { percentile: 60, timeSeconds: parseTimeToSeconds('9.51') },
                 { percentile: 55, timeSeconds: parseTimeToSeconds('10.08') },
                 { percentile: 50, timeSeconds: parseTimeToSeconds('10.22') },
                 { percentile: 45, timeSeconds: parseTimeToSeconds('10.48') },
                 { percentile: 40, timeSeconds: parseTimeToSeconds('11.05') },
                 { percentile: 35, timeSeconds: parseTimeToSeconds('11.20') },
                 { percentile: 30, timeSeconds: parseTimeToSeconds('12.00') },
                 { percentile: 25, timeSeconds: parseTimeToSeconds('12.11') },
                 { percentile: 20, timeSeconds: parseTimeToSeconds('12.40') },
                 { percentile: 15, timeSeconds: parseTimeToSeconds('13.03') },
                 { percentile: 10, timeSeconds: parseTimeToSeconds('14.01') },
                 { percentile: 5, timeSeconds: parseTimeToSeconds('15.14') },
                 { percentile: 0, timeSeconds: parseTimeToSeconds('28.50') }
            ]
        }
    },
  },
  '400m': {
    title: '400m Run Test',
    pointsMapping: { 'Excellent': 50, 'Very Good': 40, 'Average': 30, 'Fair': 20, 'Poor': 10, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Measure anaerobic capacity and speed endurance.',
    instructions: [
      // Equipment note
      'Equipment required: An athletics track or oval with a 400m distance marked, stopwatch.',
      // Procedure steps as plain sentences
      'Complete a thorough warm up with dynamic stretching.',
      'Participant runs the 400m track as fast as possible.',
      'Record the time taken with the stopwatch.', // Implied from procedure step 2
      // Reference note
      'Refer to the "400m Run Test Norms" document for comparison.'
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Time (seconds)', key: 'sec', type: 'numeric' }, ],
    resultType: 'rating',
    norms: { male: [ { rating: 'Excellent', condition: { type: 'lessThan', value: 54 } }, { rating: 'Very Good', condition: { type: 'range', min: 55, max: 64 } }, { rating: 'Average', condition: { type: 'range', min: 65, max: 69 } }, { rating: 'Fair', condition: { type: 'range', min: 70, max: 74 } }, { rating: 'Poor', condition: { type: 'greaterThan', value: 74 } }, ], female: [ { rating: 'Excellent', condition: { type: 'lessThan', value: 59 } }, { rating: 'Very Good', condition: { type: 'range', min: 60, max: 69 } }, { rating: 'Average', condition: { type: 'range', min: 70, max: 74 } }, { rating: 'Fair', condition: { type: 'range', min: 75, max: 79 } }, { rating: 'Poor', condition: { type: 'greaterThan', value: 79 } }, ], },
  },
   '800m': {
    title: '800m Run Test',
    pointsMapping: { 'Excellent': 75, 'Good': 60, 'Above Average': 50, 'Average': 40, 'Below Average': 30, 'Poor': 20, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Measure middle-distance running endurance.',
    instructions: [
      // Equipment note
      'Equipment required: A 400m running track or oval, stopwatch.',
      // Procedure steps as plain sentences
      'Complete a thorough warm-up and dynamic stretches.',
      'To start, all participants line up behind the starting line.',
      'On the command \'go,\' the stopwatch will start, and they will begin running.',
      'Encourage participants not to pace themselves, as this is a maximal effort test.',
      // Reference note (recording time is implied by stopwatch use and comparison to norms)
      'Record the time taken and refer to the "800m Run Test Norms" document for comparison.'
    ],
    inputs: [ { label: 'Minutes', key: 'min', type: 'numeric' }, { label: 'Seconds', key: 'sec', type: 'numeric' }, ],
    resultType: 'rating',
    norms: { any: [ { rating: 'Excellent', condition: { type: 'lessThanOrEqual', value: (2 * 60 + 45) } }, { rating: 'Good', condition: { type: 'range', min: (2 * 60 + 46), max: (3 * 60 + 0) } }, { rating: 'Above Average', condition: { type: 'range', min: (3 * 60 + 1), max: (3 * 60 + 15) } }, { rating: 'Average', condition: { type: 'range', min: (3 * 60 + 16), max: (3 * 60 + 30) } }, { rating: 'Below Average', condition: { type: 'range', min: (3 * 60 + 31), max: (3 * 60 + 45) } }, { rating: 'Poor', condition: { type: 'greaterThan', value: (3 * 60 + 45) } }, ] },
  },
  // --- Strength & Endurance ---
  squat: {
    title: 'Squat Test (Bodyweight)',
    pointsMapping: defaultPoints_50_Scale,
    description: 'Measure lower body muscular endurance.',
    instructions: [
      // Equipment note
      'Equipment required: A chair (ensure that the participant\'s knees bend at right angles when they are sitting in the chair).', // Note: escaped single quote
      // Procedure steps as plain sentences
      'When ready the participant sits down until their backside just touches the chair, then they return to the standing position.',
      'The participant repeats this action as many times as possible.',
      // Reference note (counting reps is implied by norms)
      'Count the number of repetitions completed and refer to the "Squats Test Norms" document for comparison.'
    ],
    inputs: [ { label: 'Age', key: 'age', type: 'age' }, { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Repetitions', key: 'reps', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'reps',
    norms: { "18-25yrs": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 49 } }, { rating: 'Good', condition: { type: 'range', min: 44, max: 48 } }, { rating: 'Above Average', condition: { type: 'range', min: 39, max: 43 } }, { rating: 'Average', condition: { type: 'range', min: 35, max: 38 } }, { rating: 'Below Average', condition: { type: 'range', min: 31, max: 34 } }, { rating: 'Poor', condition: { type: 'range', min: 25, max: 30 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 25 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 43 } }, { rating: 'Good', condition: { type: 'range', min: 37, max: 42 } }, { rating: 'Above Average', condition: { type: 'range', min: 33, max: 36 } }, { rating: 'Average', condition: { type: 'range', min: 29, max: 32 } }, { rating: 'Below Average', condition: { type: 'range', min: 25, max: 28 } }, { rating: 'Poor', condition: { type: 'range', min: 18, max: 24 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 18 } }, ], } },
  },
  pullup: {
    title: 'Pull-Up Test',
    pointsMapping: { 'Excellent': 50, 'Good': 40, 'Average': 30, 'Fair': 20, 'Poor': 10, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Measure upper body strength and endurance.',
    instructions: [
      // Equipment note
      'Equipment required: A horizontal pull-up bar set at a height so that the participant\'s feet do not touch the ground when they hang with their arms extended.', // Note: escaped single quote
      // Procedure steps as plain sentences
      'The participant hangs from the bar with their arms fully extended, with their palms facing away from their body.',
      'The participant then pulls their body up with their arms until their chin is just above the bar.',
      'The participant then lowers their body to the original starting position.',
      'This process is repeated as many times as possible.',
      // Reference note
      'Count the number of successfully completed pull-ups and refer to the "Pull Up Test Norms" document for comparison.'
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Repetitions', key: 'reps', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'reps',
    norms: { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 16 } }, { rating: 'Good', condition: { type: 'range', min: 12, max: 15 } }, { rating: 'Average', condition: { type: 'range', min: 8, max: 11 } }, { rating: 'Fair', condition: { type: 'range', min: 3, max: 7 } }, { rating: 'Poor', condition: { type: 'range', min: 0, max: 2 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 3 } }, { rating: 'Good', condition: { type: 'range', min: 2, max: 2 } }, { rating: 'Average', condition: { type: 'exact', value: 1 } }, { rating: 'Fair', condition: { type: 'exact', value: 0 } }, { rating: 'Poor', condition: { type: 'exact', value: 0 } }, ], },
  },
  pushup: {
    title: 'Timed Push-Up Test',
    pointsMapping: defaultPoints_50_Scale,
    description: 'Measure upper body muscular endurance.',
    instructions: [
      // Equipment note
      'Equipment required: A stopwatch.',
      // Procedure steps as plain sentences
      'Participant assumes the push up position with feet together and arms approx shoulder width apart.',
      'On signal, the participant completes as many push-ups as possible in 60 seconds.',
    ],
    inputs: [ { label: 'Age', key: 'age', type: 'age' }, { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Repetitions', key: 'reps', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'reps',
    norms: { "17-19": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 56 } }, { rating: 'Good', condition: { type: 'range', min: 47, max: 55 } }, { rating: 'Above Average', condition: { type: 'range', min: 35, max: 46 } }, { rating: 'Average', condition: { type: 'range', min: 19, max: 34 } }, { rating: 'Below Average', condition: { type: 'range', min: 11, max: 18 } }, { rating: 'Poor', condition: { type: 'range', min: 4, max: 10 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 4 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 35 } }, { rating: 'Good', condition: { type: 'range', min: 27, max: 34 } }, { rating: 'Above Average', condition: { type: 'range', min: 21, max: 26 } }, { rating: 'Average', condition: { type: 'range', min: 11, max: 20 } }, { rating: 'Below Average', condition: { type: 'range', min: 6, max: 10 } }, { rating: 'Poor', condition: { type: 'range', min: 2, max: 5 } }, { rating: 'Very Poor', condition: { type: 'range', min: 0, max: 1 } }, ] }, "20-29": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 47 } }, { rating: 'Good', condition: { type: 'range', min: 39, max: 46 } }, { rating: 'Above Average', condition: { type: 'range', min: 30, max: 38 } }, { rating: 'Average', condition: { type: 'range', min: 17, max: 29 } }, { rating: 'Below Average', condition: { type: 'range', min: 10, max: 16 } }, { rating: 'Poor', condition: { type: 'range', min: 4, max: 9 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 4 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 36 } }, { rating: 'Good', condition: { type: 'range', min: 30, max: 35 } }, { rating: 'Above Average', condition: { type: 'range', min: 23, max: 29 } }, { rating: 'Average', condition: { type: 'range', min: 12, max: 22 } }, { rating: 'Below Average', condition: { type: 'range', min: 7, max: 11 } }, { rating: 'Poor', condition: { type: 'range', min: 2, max: 6 } }, { rating: 'Very Poor', condition: { type: 'range', min: 0, max: 1 } }, ] }, "30-39": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 41 } }, { rating: 'Good', condition: { type: 'range', min: 34, max: 40 } }, { rating: 'Above Average', condition: { type: 'range', min: 25, max: 33 } }, { rating: 'Average', condition: { type: 'range', min: 13, max: 24 } }, { rating: 'Below Average', condition: { type: 'range', min: 8, max: 12 } }, { rating: 'Poor', condition: { type: 'range', min: 2, max: 7 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 2 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 37 } }, { rating: 'Good', condition: { type: 'range', min: 30, max: 36 } }, { rating: 'Above Average', condition: { type: 'range', min: 22, max: 29 } }, { rating: 'Average', condition: { type: 'range', min: 10, max: 21 } }, { rating: 'Below Average', condition: { type: 'range', min: 5, max: 9 } }, { rating: 'Poor', condition: { type: 'range', min: 1, max: 4 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ] }, "40-49": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 34 } }, { rating: 'Good', condition: { type: 'range', min: 28, max: 33 } }, { rating: 'Above Average', condition: { type: 'range', min: 21, max: 27 } }, { rating: 'Average', condition: { type: 'range', min: 11, max: 20 } }, { rating: 'Below Average', condition: { type: 'range', min: 6, max: 10 } }, { rating: 'Poor', condition: { type: 'range', min: 1, max: 5 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 31 } }, { rating: 'Good', condition: { type: 'range', min: 25, max: 30 } }, { rating: 'Above Average', condition: { type: 'range', min: 18, max: 24 } }, { rating: 'Average', condition: { type: 'range', min: 8, max: 17 } }, { rating: 'Below Average', condition: { type: 'range', min: 4, max: 7 } }, { rating: 'Poor', condition: { type: 'range', min: 1, max: 3 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ] }, "50-59": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 31 } }, { rating: 'Good', condition: { type: 'range', min: 25, max: 30 } }, { rating: 'Above Average', condition: { type: 'range', min: 18, max: 24 } }, { rating: 'Average', condition: { type: 'range', min: 9, max: 17 } }, { rating: 'Below Average', condition: { type: 'range', min: 5, max: 8 } }, { rating: 'Poor', condition: { type: 'range', min: 1, max: 4 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 25 } }, { rating: 'Good', condition: { type: 'range', min: 21, max: 24 } }, { rating: 'Above Average', condition: { type: 'range', min: 15, max: 20 } }, { rating: 'Average', condition: { type: 'range', min: 7, max: 14 } }, { rating: 'Below Average', condition: { type: 'range', min: 3, max: 6 } }, { rating: 'Poor', condition: { type: 'range', min: 1, max: 2 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ] }, "60-65": { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 30 } }, { rating: 'Good', condition: { type: 'range', min: 24, max: 29 } }, { rating: 'Above Average', condition: { type: 'range', min: 17, max: 23 } }, { rating: 'Average', condition: { type: 'range', min: 6, max: 16 } }, { rating: 'Below Average', condition: { type: 'range', min: 3, max: 5 } }, { rating: 'Poor', condition: { type: 'range', min: 1, max: 2 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 23 } }, { rating: 'Good', condition: { type: 'range', min: 19, max: 22 } }, { rating: 'Above Average', condition: { type: 'range', min: 13, max: 18 } }, { rating: 'Average', condition: { type: 'range', min: 5, max: 12 } }, { rating: 'Below Average', condition: { type: 'range', min: 2, max: 4 } }, { rating: 'Poor', condition: { type: 'exact', value: 1 } }, { rating: 'Very Poor', condition: { type: 'exact', value: 0 } }, ] } },
  },

  // --- Flexibility Tests ---
  sitreach: {
    title: 'Sit and Reach Test',
    pointsMapping: defaultPoints_30_Scale,
    description: 'Measure hamstring and lower back flexibility.',
    instructions: [
      // Equipment note
      'Equipment required: A sit and reach box (preferred) or a box and ruler.',
      // Procedure steps as plain sentences
      'The participant performs a thorough warmup and dynamic stretching.',
      'Have participants remove their shoes and sit on the floor with head, back and hips at 90 degree angle from the hip joint.',
      'Have the participant extend one leg at a time while the sole of the other foot remains against the inside of the extended leg\'s knee.', // Note: escaped single quote
      'The participant places one hand on top of the other and reaches as far forward as possible along the measuring line.',
      'Ensure that the hands remain at the same level, not one reaching further forward than the other.',
      'After some practice reaches, the subject reaches out and holds that position for at least one-two seconds while the distance is recorded.',
      
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Measurement (cm)', key: 'cm', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'cm',
    norms: { male: [ { rating: 'Super', condition: { type: 'greaterThan', value: 27 } }, { rating: 'Excellent', condition: { type: 'range', min: 17, max: 27 } }, { rating: 'Good', condition: { type: 'range', min: 6, max: 16 } }, { rating: 'Average', condition: { type: 'range', min: 0, max: 5 } }, { rating: 'Fair', condition: { type: 'range', min: -8, max: -1 } }, { rating: 'Poor', condition: { type: 'range', min: -20, max: -9 } }, { rating: 'Very Poor', condition: { type: 'lessThanOrEqual', value: -20 } }, ], female: [ { rating: 'Super', condition: { type: 'greaterThan', value: 30 } }, { rating: 'Excellent', condition: { type: 'range', min: 21, max: 30 } }, { rating: 'Good', condition: { type: 'range', min: 11, max: 20 } }, { rating: 'Average', condition: { type: 'range', min: 1, max: 10 } }, { rating: 'Fair', condition: { type: 'range', min: -7, max: 0 } }, { rating: 'Poor', condition: { type: 'range', min: -15, max: -8 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: -15 } }, ], },
  },
  trunk: {
    title: 'Trunk Rotation Test',
    pointsMapping: { 'Excellent': 30, 'Very Good': 25, 'Good': 20, 'Fair': 15, 'Poor': 10, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Measure trunk flexibility.',
    instructions: [
      // Equipment note
      'Equipment required: Chalk and a solid wall.',
      // Procedure steps as plain sentences
      'Mark a vertical line on the wall with chalk.',
      'Have the participant stand with their back to the wall directly in front of the line.',
      'Have them stand about an arm\'s length away from the wall with their feet shoulder width apart.', // Note: escaped single quote
      'Have them extend their arms out directly in front so they are parallel to the floor.',
      'They twist their trunk to one side (e.g., right) and touch the wall behind them with their fingertips.',
      'Their arms should stay extended and parallel to the floor. They can turn their shoulders, hips, and knees as long as their feet don\'t move.', // Note: escaped single quote
      'Mark the position where the fingertips touched the wall.',
      'Measure the distance between the vertical line and the point where the fingertips reached.',
      'A point reached before the line gives a negative score, and a point reached after the line gives a positive score.', // Scoring info from step 5
      'Repeat the twist and measurement on the opposite side of the body.', 
    ],
    inputs: [{ label: 'Measurement (cm)', key: 'cm', type: 'numeric' }],
    resultType: 'rating', resultUnit: 'cm',
    norms: { any: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 20 } }, { rating: 'Very Good', condition: { type: 'greaterThanOrEqual', value: 15 } }, { rating: 'Good', condition: { type: 'greaterThanOrEqual', value: 10 } }, { rating: 'Fair', condition: { type: 'greaterThanOrEqual', value: 5 } }, { rating: 'Poor', condition: { type: 'lessThan', value: 5 } }, ], },
  },
  shoulder: {
    title: 'Shoulder Elevation Test',
    pointsMapping: { 'Excellent': 30, 'Good': 25, 'Average': 20, 'Fair': 15, 'Poor': 10, 'Rating Undefined': 0, 'Norms not available': 0 },
    description: 'Measure shoulder flexibility/mobility.',
    instructions: [
      // Equipment note
      'Equipment required: Tape measure, 2 x metre rulers.',
      // Procedure steps as plain sentences
      'Measure the length of the participant\'s arm from their acromial process (edge of shoulder) to their fingertips. This is known as your arm length.', // Note: escaped single quote
      'Have the participant lie on the floor with their arms fully extended overhead.',
      'Have them grasp one ruler with their hands shoulder width apart.',
      'The participant raises the ruler as high as possible while keeping their chin on the floor.',
      'The assistant reads the measurement off the second ruler which is held vertical. This is known as your measurement length.',
      'A norm can then be calculated by using the formula: Arm length - Measurement length.', 
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Measurement (cm)', key: 'cm', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'cm',
    norms: { male: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 33 } }, { rating: 'Good', condition: { type: 'range', min: 30, max: 32 } }, { rating: 'Average', condition: { type: 'range', min: 20, max: 29 } }, { rating: 'Fair', condition: { type: 'range', min: 15, max: 19 } }, { rating: 'Poor', condition: { type: 'lessThan', value: 15 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThanOrEqual', value: 31 } }, { rating: 'Good', condition: { type: 'range', min: 28, max: 30 } }, { rating: 'Average', condition: { type: 'range', min: 20, max: 27 } }, { rating: 'Fair', condition: { type: 'range', min: 14, max: 19 } }, { rating: 'Poor', condition: { type: 'lessThan', value: 14 } }, ], },
  },

  // --- Other Assessments ---
  bmi: {
    title: 'Body Mass Index (BMI)',
    pointsMapping: bmiPoints,
    description: 'Calculate BMI based on height and weight.',
    instructions: [
      // Equipment note
      'Equipment required: Devices designed to measure weight and height (e.g. measuring tape/scales).',
      // Procedure steps as plain sentences
      'Take shoes and any heavy clothing off.',
      'Stand on scales and record weight in Kilograms.',
      'Measure height in metres.',
      'Utilise the formula BMI = weight / (height x height) to determine your BMI.', // Formula included
      
    ],
    inputs: [ { label: 'Height (cm)', key: 'height', type: 'numeric' }, { label: 'Weight (kg)', key: 'weight', type: 'numeric' }, ],
    formula: 'BMI = Weight (kg) / (Height (m)²) ',
    resultType: 'value_and_rating', resultUnit: 'kg/m²',
    norms: { any: [ { rating: 'Underweight', condition: { type: 'lessThan', value: 18.5 } }, { rating: 'Normal', condition: { type: 'range', min: 18.5, max: 24.9 } }, { rating: 'Overweight', condition: { type: 'range', min: 25.0, max: 29.9 } }, { rating: 'Obese', condition: { type: 'greaterThanOrEqual', value: 30 } }, ], },
  },
  illinois: {
    title: 'Illinois Agility Test',
    pointsMapping: defaultPoints_75_Scale,
    description: 'Measure speed and agility.',
    instructions: [
      // Equipment note
      'Equipment required: Stopwatch, cones, non-slip surface, tape measure.',
      // Procedure steps as plain sentences
      'Set-up the course as per the diagram (The length of the course is 10 metres and the width of the course is 5 metres. Four cones are also used to mark the start, the finish and the two turning points).', // Course setup details included
      'Place another 4 cones down the centre an equal distance of 3.3 metres apart.',
      'Participants lie down at the start and put their hands to their sides.',
      'On a designated signal, the stopwatch is started and the participants run the course as fast as possible in the direction indicated on the diagram.',
      
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Time (seconds)', key: 'sec', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'seconds',
    norms: { male: [ { rating: 'Excellent', condition: { type: 'lessThan', value: 15.1 } }, { rating: 'Good', condition: { type: 'range', min: 15.1, max: 16.1 } }, { rating: 'Average', condition: { type: 'range', min: 16.2, max: 18.1 } }, { rating: 'Fair', condition: { type: 'range', min: 18.2, max: 18.3 } }, { rating: 'Poor', condition: { type: 'greaterThan', value: 18.3 } }, ], female: [ { rating: 'Excellent', condition: { type: 'lessThan', value: 17.1 } }, { rating: 'Good', condition: { type: 'range', min: 17.1, max: 18.0 } }, { rating: 'Average', condition: { type: 'range', min: 18.1, max: 21.8 } }, { rating: 'Fair', condition: { type: 'range', min: 21.9, max: 23.1 } }, { rating: 'Poor', condition: { type: 'greaterThan', value: 23.1 } }, ], },
  },
  vertical: {
    title: 'Vertical Jump Test',
    pointsMapping: defaultPoints_50_Scale,
    description: 'Measure explosive leg power.',
    instructions: [
      // Equipment note
      'Equipment required: A ruler/measuring tape, chalk and a wall.',
      // Procedure steps as plain sentences
      'The athlete stands side on to a wall and reaches up with the hand closest to the wall.',
      'Keeping the feet flat on the ground, the point of the fingertips is marked or recorded using the chalk. This is known as the standing reach height.',
      'The athlete then stands away from the wall, and leaps vertically as high as possible and attempts to touch/mark the wall at the highest point of the jump.',
      'The difference in distance between the standing reach height and the jump height is the score.', // Scoring calculation included
      'Record the best of three attempts.', 
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Jump Height Difference (cm)', key: 'cm', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'cm',
    norms: { male: [ { rating: 'Excellent', condition: { type: 'greaterThan', value: 70 } }, { rating: 'Good', condition: { type: 'range', min: 56, max: 70 } }, { rating: 'Average', condition: { type: 'range', min: 41, max: 55 } }, { rating: 'Fair', condition: { type: 'range', min: 31, max: 40 } }, { rating: 'Poor', condition: { type: 'lessThanOrEqual', value: 30 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThan', value: 60 } }, { rating: 'Good', condition: { type: 'range', min: 46, max: 60 } }, { rating: 'Average', condition: { type: 'range', min: 31, max: 45 } }, { rating: 'Fair', condition: { type: 'range', min: 21, max: 30 } }, { rating: 'Poor', condition: { type: 'lessThanOrEqual', value: 20 } }, ], },
  },
  longjump: {
    title: 'Standing Long Jump',
    pointsMapping: defaultPoints_50_Scale,
    description: 'Measure explosive leg power.',
    instructions: [
      // Equipment note
      'Equipment required: Measuring tape, non-slip floor for take-off.',
      // Procedure steps as plain sentences
      'The performer stands behind a line marked on the ground with feet slightly apart.',
      'A two foot take-off and landing is used.',
      'Swinging of the arms and bending of the knees to provide forward drive is allowed.',
      'The performer attempts to jump as far as possible, landing on both feet without falling backwards.',
      'Measurement is taken from the take-off mark to the nearest point of contact in the landing, which is usually the back of the heel.',
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Distance (cm)', key: 'cm', type: 'numeric' }, ],
    resultType: 'rating', resultUnit: 'cm',
     norms: { male: [ { rating: 'Excellent', condition: { type: 'greaterThan', value: 250 } }, { rating: 'Very Good', condition: { type: 'range', min: 241, max: 250 } }, { rating: 'Above Average', condition: { type: 'range', min: 231, max: 240 } }, { rating: 'Average', condition: { type: 'range', min: 221, max: 230 } }, { rating: 'Below Average', condition: { type: 'range', min: 211, max: 220 } }, { rating: 'Poor', condition: { type: 'range', min: 191, max: 210 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 191 } }, ], female: [ { rating: 'Excellent', condition: { type: 'greaterThan', value: 200 } }, { rating: 'Very Good', condition: { type: 'range', min: 191, max: 200 } }, { rating: 'Above Average', condition: { type: 'range', min: 181, max: 190 } }, { rating: 'Average', condition: { type: 'range', min: 171, max: 180 } }, { rating: 'Below Average', condition: { type: 'range', min: 161, max: 170 } }, { rating: 'Poor', condition: { type: 'range', min: 141, max: 160 } }, { rating: 'Very Poor', condition: { type: 'lessThan', value: 141 } }, ], },
  },
  '50m': {
    title: '50 Metre Sprint',
    pointsMapping: defaultPoints_50_Scale,
    description: 'Measure maximum running speed.',
    instructions: [
      // Equipment note
      'Equipment required: Stopwatches, Cones, Measuring Tape (to mark 50m).',
      // Procedure steps as plain sentences
      'Perform the test in pairs; one member acts as the timekeeper, the other the participant.',
      'The participant starts from a stationary position.',
      'On a signal, the participant sprints as fast as possible to the 50m end line.',
      'The timekeeper stops the stopwatch and shares the time with the participant.',
      'Swap roles so both individuals are tested.',
    ],
    inputs: [ { label: 'Gender (male/female)', key: 'gender', type: 'gender' }, { label: 'Time (seconds)', key: 'sec', type: 'numeric' }, ],
     resultType: 'rating', resultUnit: 'seconds',
     norms: { male: [ { rating: 'Excellent', condition: { type: 'lessThan', value: 7.1 } }, { rating: 'Good', condition: { type: 'range', min: 7.1, max: 7.3 } }, { rating: 'Average', condition: { type: 'range', min: 7.4, max: 7.8 } }, { rating: 'Fair', condition: { type: 'range', min: 7.9, max: 8.2 } }, { rating: 'Poor', condition: { type: 'greaterThan', value: 8.2 } }, ], female: [ { rating: 'Excellent', condition: { type: 'lessThan', value: 8.0 } }, { rating: 'Good', condition: { type: 'range', min: 8.0, max: 8.4 } }, { rating: 'Average', condition: { type: 'range', min: 8.5, max: 8.9 } }, { rating: 'Fair', condition: { type: 'range', min: 9.0, max: 9.3 } }, { rating: 'Poor', condition: { type: 'greaterThan', value: 9.3 } }, ], },
  },
  stork: {
    title: 'Stork Balance Test',
    pointsMapping: defaultPoints_30_Scale,
    description: 'Measure static balance.',
    instructions: [
      // Equipment note
      'Equipment required: Stopwatch.',
      // Procedure steps as plain sentences
      'Remove shoes and stand on a flat surface with hands on hips.',
      'Stand on one foot and position the other foot against the inside knee of the supporting leg.',
      'On the starting signal, raise your heel and balance on the ball of your foot.',
      'Timing is commenced upon raising the heel.',
      'The timekeeper stops recording when any of the following occurs:',
      ' - One or both hands come off your hips.',
      ' - Your supporting foot switches or moves in any direction.',
      ' - The heel of the supporting foot touches the floor.',
      ' - Your non-supporting foot loses contact with the knee.',
    ],
    inputs: [{ label: 'Time (seconds)', key: 'sec', type: 'numeric' }],
    resultType: 'rating', resultUnit: 'seconds',
    norms: { any: [ { rating: 'Excellent', condition: { type: 'greaterThan', value: 50 } }, { rating: 'Good', condition: { type: 'range', min: 40, max: 50 } }, { rating: 'Average', condition: { type: 'range', min: 25, max: 39 } }, { rating: 'Fair', condition: { type: 'range', min: 10, max: 24 } }, { rating: 'Poor', condition: { type: 'lessThan', value: 10 } }, ], },
  },
};
// --- End Test Data ---


// --- Component ---
export default function TestScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const test = testData[id as string];
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | number | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [pointsAwardedDisplay, setPointsAwardedDisplay] = useState<number | null>(null);

   // Reset state when navigating to a new test or screen focuses
   useFocusEffect(
    useCallback(() => {
        setInputs({});
        setResult(null);
        setRating(null);
        setPointsAwardedDisplay(null); // <-- ADD RESET HERE
        setIsCalculating(false);
        console.log(`Test screen focused for ID: ${id}`);
    }, [id])
);

  if (!test) {
     return (
       <SafeAreaView style={styles.container}>
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.title}>Test Not Found</Text>
          </View>
         <View style={styles.content}>
              <Text>The requested test details could not be loaded.</Text>
         </View>
       </SafeAreaView>
     );
  }

  // --- Calculation & Saving Logic ---
  const calculateResult = async () => {
    const currentId = id as string;
    const testDetails = testData[currentId];
    if (!testDetails || !user) {
        Alert.alert("Error", "User not logged in or test details missing.");
        return;
    }

    setIsCalculating(true);
    setResult(null);
    setRating(null);
    setPointsAwardedDisplay(null);

    let calculatedValue: number | string | null = null;
    let calculatedRating: string | null = null;
    const gender = inputs.gender?.toLowerCase().trim();
    const age = parseInt(inputs.age, 10);
    let processedValueForRating: number | null = null;

    try {
        // --- Calculation Switch Statement ---
        switch (currentId) {
             case 'queens': {
                 const hr = parseFloat(inputs.hr);
                 if (isNaN(hr) || !gender) throw new Error('Missing HR or Gender');
                 processedValueForRating = hr;
                 if (gender === 'male') {
                     calculatedValue = 111.33 - 0.42 * hr;
                     calculatedRating = getRatingFromNorms(processedValueForRating, testDetails.norms?.male);
                 } else if (gender === 'female') {
                     calculatedValue = 65.81 - 0.1847 * hr;
                     calculatedRating = getRatingFromNorms(processedValueForRating, testDetails.norms?.female);
                 } else { throw new Error('Invalid Gender'); }
                 calculatedValue = Math.round(calculatedValue * 10) / 10;
                 break;
             }
             case 'beep': {
                 const level = parseFloat(inputs.level);
                 if (isNaN(level) || isNaN(age) || !gender) throw new Error('Missing Level, Age or Gender');
                 processedValueForRating = level;
                 const ageNorms = testDetails.norms as AgeGenderNorms;
                 const ageKey = getAgeRangeKey(age, Object.keys(ageNorms));
                 if (!ageKey) throw new Error('Age out of range for norms');
                 const genderNorms = ageNorms[ageKey]?.[gender as keyof GenderNorms];
                 calculatedRating = getRatingFromNorms(processedValueForRating, genderNorms);
                 calculatedValue = level;
                 break;
             }
             case '1-6km': {
              const min = parseFloat(inputs.min) || 0;
              const sec = parseFloat(inputs.sec) || 0;
              if (isNaN(min) || isNaN(sec)) throw new Error('Missing Minutes or Seconds');
              if (isNaN(age) || !gender) throw new Error('Missing Age or Gender');

              const totalSeconds = min * 60 + sec;
              processedValueForRating = totalSeconds; // Keep this for potential future use

              // Use the new helper to get the rating based on percentile
              calculatedRating = getRatingFromPercentile(
                  totalSeconds,
                  gender,
                  age,
                  testDetails.norms
              );

              // Set calculatedValue for display (optional, could just show rating)
              calculatedValue = calculatedRating; // Or keep time: `${min}:${sec < 10 ? '0' : ''}${sec}`;

              break;
         }
              case '800m': {
                 const min = parseFloat(inputs.min) || 0;
                 const sec = parseFloat(inputs.sec) || 0;
                  if (isNaN(min) || isNaN(sec)) throw new Error('Missing Minutes or Seconds');
                  const totalSeconds = min * 60 + sec;
                  processedValueForRating = totalSeconds;
                  calculatedValue = `${min}:${sec < 10 ? '0' : ''}${sec}`;
                  calculatedRating = getRatingFromNorms(processedValueForRating, testDetails.norms?.any);
                  break;
              }
           case '400m':
           case 'illinois':
           case '50m': {
                const sec = parseFloat(inputs.sec);
                if (isNaN(sec)) throw new Error('Missing Seconds');
                processedValueForRating = sec;
                calculatedValue = sec;
                const selectedNorms = gender ? testDetails.norms?.[gender as keyof GenderNorms] : testDetails.norms?.any;
                if(!selectedNorms && gender && testDetails.norms?.male && testDetails.norms?.female) throw new Error('Gender required or norms missing for this test');
                calculatedRating = getRatingFromNorms(processedValueForRating, selectedNorms);
                break;
           }
           case 'squat':
           case 'pushup': {
                const reps = parseInt(inputs.reps, 10);
                if (isNaN(reps) || isNaN(age) || !gender) throw new Error('Missing Reps, Age or Gender');
                processedValueForRating = reps;
                calculatedValue = reps;
                const ageNorms = testDetails.norms as AgeGenderNorms;
                const ageKey = getAgeRangeKey(age, Object.keys(ageNorms));
                if (!ageKey) throw new Error('Age out of range for norms');
                const genderNorms = ageNorms[ageKey]?.[gender as keyof GenderNorms];
                calculatedRating = getRatingFromNorms(processedValueForRating, genderNorms);
                break;
           }
           case 'pullup': {
               const reps = parseInt(inputs.reps, 10);
               if (isNaN(reps) || !gender) throw new Error('Missing Reps or Gender');
               processedValueForRating = reps;
               calculatedValue = reps;
               const genderNorms = testDetails.norms?.[gender as keyof GenderNorms];
               calculatedRating = getRatingFromNorms(processedValueForRating, genderNorms);
               break;
           }
           case 'sitreach':
           case 'shoulder':
           case 'vertical':
           case 'longjump': {
                const cm = parseFloat(inputs.cm);
                if (isNaN(cm) || !gender) throw new Error('Missing Measurement or Gender');
                processedValueForRating = cm;
                calculatedValue = cm;
                const genderNorms = testDetails.norms?.[gender as keyof GenderNorms];
                calculatedRating = getRatingFromNorms(processedValueForRating, genderNorms);
                break;
           }
           case 'trunk': {
                const cm = parseFloat(inputs.cm);
                if (isNaN(cm)) throw new Error('Missing Measurement (cm)');
                processedValueForRating = cm;
                calculatedValue = cm;
                calculatedRating = getRatingFromNorms(processedValueForRating, testDetails.norms?.any);
                break;
           }
           case 'stork': {
               const sec = parseFloat(inputs.sec);
               if (isNaN(sec)) throw new Error('Missing Measurement (seconds)');
               processedValueForRating = sec;
               calculatedValue = sec;
               calculatedRating = getRatingFromNorms(processedValueForRating, testDetails.norms?.any);
               break;
           }
            case 'bmi': {
                const heightCm = parseFloat(inputs.height);
                const weightKg = parseFloat(inputs.weight);
                if (isNaN(heightCm) || isNaN(weightKg) || heightCm <= 0 || weightKg <= 0) { throw new Error('Invalid Height or Weight'); }
                const heightM = heightCm / 100;
                const bmiResult = weightKg / (heightM * heightM);
                calculatedValue = Math.round(bmiResult * 10) / 10;
                processedValueForRating = calculatedValue;
                calculatedRating = getRatingFromNorms(processedValueForRating, testDetails.norms?.any);
                break;
            }
             default:
                calculatedRating = 'Calculation not implemented';
                calculatedValue = calculatedRating;
                processedValueForRating = null;
        }
        // --- End Calculation Switch ---

        // --- Set State ---
        if (testDetails.resultType === 'rating' && calculatedRating) {
            setResult(calculatedRating); setRating(null);
        } else if (testDetails.resultType === 'value' && calculatedValue !== null) {
            setResult(calculatedValue); setRating(null);
        } else if (testDetails.resultType === 'value_and_rating') {
            setResult(calculatedValue); setRating(calculatedRating);
        } else {
             setResult(calculatedValue ?? calculatedRating ?? "Error"); setRating(calculatedRating);
        }
        // --- End Set State ---

        // --- Save to Firestore ---
        if (!testDetails.pointsMapping) {
             console.warn(`No pointsMapping defined for test ID: ${currentId}. Result not saved with points.`);
             throw new Error(`Scoring definition missing for ${testDetails.title}`); // Prevent saving without points definition
        }
        try {
            const ratingKey = calculatedRating ?? 'Rating Undefined';
            const pointsAwarded = testDetails.pointsMapping[ratingKey] ?? 0;
            console.log(`Calculated Rating: ${ratingKey}, Points Awarded: ${pointsAwarded}`);
            setPointsAwardedDisplay(pointsAwarded);

            const testResultData = {
                userId: user.uid,
                testId: currentId,
                testName: testDetails.title,
                timestamp: serverTimestamp(),
                inputs: inputs, // Store what the user entered
                resultValue: calculatedValue, // The primary value calculated/displayed (can be string or number)
                rating: calculatedRating, // The rating string ("Excellent", etc.)
                pointsAwarded: pointsAwarded // Use looked-up points
            };

            const historyCollectionRef = collection(db, 'users', user.uid, 'testHistory');
        await addDoc(historyCollectionRef, testResultData);
        console.log("Test result saved successfully!");
        Alert.alert("Success", `Test result saved! +${pointsAwarded} points`);

         // ---------- START: RECALCULATE AND UPDATE TOTAL POINTS ----------

        try {
          console.log("Attempting to recalculate total points after adding test...");
          // 1. Fetch all test results for this user (including the new one)
          const allTestsSnapshot = await getDocs(historyCollectionRef);

          // 2. Calculate the new total sum
          let newTotal = 0;
          allTestsSnapshot.forEach((testDoc) => {
              const points = testDoc.data()?.pointsAwarded;
              newTotal += (typeof points === 'number' ? points : 0);
          });
          console.log(`New calculated total points: ${newTotal}`);

          // 3. Get reference to the main user document
          const userDocRef = doc(db, 'users', user.uid);

          // 4. Update the totalPoints field in the user document
          await updateDoc(userDocRef, {
              totalPoints: newTotal
          });
          console.log("Successfully updated user's totalPoints in Firestore.");

      } catch (updateError: any) {
          console.error("Error updating total points after saving test:", updateError);
          // Log error, maybe show non-blocking feedback later
      }

      // ---------- END: RECALCULATE AND UPDATE TOTAL POINTS ----------

        } catch (saveError: any) {
            console.error("Error saving test result to Firestore:", saveError);
            Alert.alert("Save Error", `Could not save test result: ${saveError.message}`);
            setIsCalculating(false); // Ensure button is re-enabled if save fails
            return; // Stop if save fails
        }
        // --- End Save to Firestore ---

    } catch (calcError: any) {
         console.error("Calculation Error:", calcError);
         Alert.alert("Calculation Error", calcError.message || "Please check your inputs.");
         setResult(null);
         setRating(null);
         setPointsAwardedDisplay(null);
    } finally {
         setIsCalculating(false);
    }
  }; // --- End calculateResult ---


  // --- Render ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>{test.title}</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.description}>{test.description}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {test.instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>{index + 1}</Text>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>

        {test.formula && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Formula</Text>
                <Text style={styles.formulaText}>{test.formula}</Text>
            </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Measurements</Text>
          {test.inputs.map((input) => (
            <View key={input.key} style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{input.label}{input.unit ? ` (${input.unit})` : ''}</Text>
              <TextInput
                style={styles.input}
                keyboardType={input.type === 'numeric' || input.type === 'age' ? 'numeric' : 'default'}
                autoCapitalize={input.type === 'gender' ? 'none' : 'sentences'}
                value={inputs[input.key] || ''}
                onChangeText={(value) => setInputs({ ...inputs, [input.key]: value })}
                placeholder={`Enter ${input.label.toLowerCase()}`}
              />
            </View>
          ))}
        </View>

        {/* Result Display */}
        {(result !== null || rating !== null || pointsAwardedDisplay !== null) && ( // Adjust condition slightly
            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>Your Result:</Text>
              {/* Keep existing result rendering */}
              {typeof result === 'number' && ( <Text style={styles.resultValue}>{result} {test.resultUnit || ''}</Text> )}
              {typeof result === 'string' && !rating && ( <Text style={styles.resultValue}>{result}</Text> )} {/* Handle rating-only display */}
              {rating && ( <Text style={styles.ratingValue}>Rating: {rating}</Text> )}

              {/* --- ADD THIS LINE --- */}
              {pointsAwardedDisplay !== null && (
                  <Text style={styles.pointsValue}>Points Awarded: {pointsAwardedDisplay}</Text>
              )}
              {/* -------------------- */}
            </View>
        )}

        {/* Calculate Button */}
        <TouchableOpacity
            style={[styles.calculateButton, isCalculating && styles.buttonDisabled]}
            onPress={calculateResult}
            disabled={isCalculating}
            >
            {isCalculating ? (
                <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
                <Check size={20} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.calculateButtonText}>
                {isCalculating ? 'Calculating...' : 'Calculate & Save Result'}
            </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
     container: { flex: 1, backgroundColor: '#f3f4f6', },
     header: { padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', },
     backButton: { marginRight: 12, padding: 5, },
     title: { fontSize: 20, fontWeight: 'bold', color: '#111827', flex: 1, },
     content: { flex: 1, padding: 20, },
     description: { fontSize: 16, color: '#4b5563', marginBottom: 24, lineHeight: 24, },
     section: { marginBottom: 24, },
     sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 12, },
     instructionItem: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start', },
     instructionNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#6366f1', color: '#ffffff', textAlign: 'center', lineHeight: 24, marginRight: 12, fontSize: 14, fontWeight: '500', flexShrink: 0, },
     instructionText: { flex: 1, fontSize: 15, color: '#4b5563', lineHeight: 22, },
     formulaText: { fontSize: 15, color: '#4b5563', lineHeight: 22, fontFamily: 'monospace', backgroundColor: '#ffffff', padding: 10, borderRadius: 8, },
     inputContainer: { marginBottom: 16, },
     inputLabel: { fontSize: 14, color: '#374151', marginBottom: 8, fontWeight: '500', },
     input: { backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#d1d5db', color: '#111827', },
     calculateButton: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 30, },
     calculateButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600', },
     resultContainer: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 20, marginTop: 10, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#c7d2fe', },
     resultLabel: { fontSize: 16, color: '#4338ca', marginBottom: 8, fontWeight: '600', },
     resultValue: { fontSize: 28, fontWeight: 'bold', color: '#6366f1', marginBottom: 4, },
     ratingValue: { fontSize: 18, fontWeight: '500', color: '#374151', marginTop: 4, },
     buttonDisabled: { backgroundColor: '#a5b4fc', },
  pointsValue: { 
      fontSize: 16, 
      fontWeight: '500',
      color: '#10b981', 
      marginTop: 8,     
  },
});