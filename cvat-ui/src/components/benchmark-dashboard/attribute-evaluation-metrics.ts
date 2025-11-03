// Attribute Evaluation Metrics Utilities
// Handles dynamic calculation of metrics for different attribute types

export interface AttributeSpec {
  name: string;
  type: 'categorical' | 'boolean' | 'numeric' | 'text' | 'checklist';
  values?: string[]; // For categorical/checklist
  min?: number; // For numeric
  max?: number; // For numeric
}

export interface AttributePrediction {
  attribute_name: string;
  predicted_value: any;
  ground_truth_value: any;
  confidence?: number;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
  total_samples: number;
}

export interface AttributeMetrics {
  attribute_name: string;
  attribute_type: string;
  accuracy?: number;
  f1_score?: number;
  precision?: number;
  recall?: number;
  mae?: number; // Mean Absolute Error for numeric
  rmse?: number; // Root Mean Square Error for numeric
  cer?: number; // Character Error Rate for text
  wer?: number; // Word Error Rate for text
  exact_match?: number; // For text/checklist
  confusion_matrix?: ConfusionMatrix;
  outliers?: Array<{
    predicted: any;
    ground_truth: any;
    error: number;
    sample_id: string;
  }>;
  sample_errors?: Array<{
    predicted: any;
    ground_truth: any;
    sample_id: string;
  }>;
}

export interface GlobalAttributeMetrics {
  total_attributes: number;
  total_samples: number;
  attr_macro_f1: number;
  attr_weighted_f1: number;
  joint_correctness: number; // Percentage of samples where ALL attributes are correct
  mean_attribute_accuracy: number;
  attribute_coverage: number; // Percentage of attributes with predictions
}

export interface CompositionAnalysis {
  joint_correctness: number;
  partial_correctness_distribution: { [key: string]: number }; // e.g., "0_correct": 5%, "1_correct": 15%
  top_failure_patterns: Array<{
    pattern: string;
    frequency: number;
    example_attributes: string[];
  }>;
  attribute_correlation_errors: Array<{
    attr1: string;
    attr2: string;
    correlation_score: number;
    joint_error_rate: number;
  }>;
}

// Utility functions for different attribute types
export class AttributeEvaluator {
  static calculateCategoricalMetrics(
    predictions: AttributePrediction[],
    attributeSpec: AttributeSpec
  ): AttributeMetrics {
    const labels = attributeSpec.values || [];
    const confusionMatrix = this.buildConfusionMatrix(predictions, labels);
    
    const accuracy = this.calculateAccuracy(predictions);
    const { precision, recall, f1_score } = this.calculatePRF1(confusionMatrix);
    
    const sampleErrors = predictions
      .filter(p => p.predicted_value !== p.ground_truth_value)
      .slice(0, 5)
      .map(p => ({
        predicted: p.predicted_value,
        ground_truth: p.ground_truth_value,
        sample_id: `sample_${Math.random().toString(36).substr(2, 9)}`
      }));

    return {
      attribute_name: predictions[0]?.attribute_name || '',
      attribute_type: 'categorical',
      accuracy,
      f1_score,
      precision,
      recall,
      confusion_matrix: confusionMatrix,
      sample_errors: sampleErrors
    };
  }

  static calculateBooleanMetrics(predictions: AttributePrediction[]): AttributeMetrics {
    const accuracy = this.calculateAccuracy(predictions);
    const confusionMatrix = this.buildConfusionMatrix(predictions, ['true', 'false']);
    const { precision, recall, f1_score } = this.calculatePRF1(confusionMatrix);

    return {
      attribute_name: predictions[0]?.attribute_name || '',
      attribute_type: 'boolean',
      accuracy,
      f1_score,
      precision,
      recall,
      confusion_matrix: confusionMatrix
    };
  }

  static calculateNumericMetrics(predictions: AttributePrediction[]): AttributeMetrics {
    const errors = predictions.map(p => 
      Math.abs(Number(p.predicted_value) - Number(p.ground_truth_value))
    );
    
    const mae = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const rmse = Math.sqrt(
      errors.map(err => err * err).reduce((sum, err) => sum + err, 0) / errors.length
    );
    
    const exactMatch = predictions.filter(p => 
      Number(p.predicted_value) === Number(p.ground_truth_value)
    ).length / predictions.length;

    // Find outliers (errors > 2 standard deviations)
    const meanError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const stdError = Math.sqrt(
      errors.map(err => (err - meanError) ** 2).reduce((sum, sq) => sum + sq, 0) / errors.length
    );
    
    const outliers = predictions
      .map((p, i) => ({
        predicted: p.predicted_value,
        ground_truth: p.ground_truth_value,
        error: errors[i],
        sample_id: `sample_${Math.random().toString(36).substr(2, 9)}`
      }))
      .filter(item => item.error > meanError + 2 * stdError)
      .slice(0, 5);

    return {
      attribute_name: predictions[0]?.attribute_name || '',
      attribute_type: 'numeric',
      mae,
      rmse,
      exact_match: exactMatch,
      outliers
    };
  }

  static calculateTextMetrics(predictions: AttributePrediction[]): AttributeMetrics {
    const exactMatch = predictions.filter(p => 
      p.predicted_value === p.ground_truth_value
    ).length / predictions.length;

    // Calculate Character Error Rate (CER)
    let totalChars = 0;
    let totalCharErrors = 0;
    
    // Calculate Word Error Rate (WER)
    let totalWords = 0;
    let totalWordErrors = 0;

    predictions.forEach(p => {
      const pred = String(p.predicted_value);
      const gt = String(p.ground_truth_value);
      
      // CER calculation
      totalChars += gt.length;
      totalCharErrors += this.levenshteinDistance(pred, gt);
      
      // WER calculation
      const predWords = pred.split(/\s+/);
      const gtWords = gt.split(/\s+/);
      totalWords += gtWords.length;
      totalWordErrors += this.levenshteinDistance(predWords, gtWords);
    });

    const cer = totalCharErrors / totalChars;
    const wer = totalWordErrors / totalWords;

    const sampleErrors = predictions
      .filter(p => p.predicted_value !== p.ground_truth_value)
      .slice(0, 5)
      .map(p => ({
        predicted: p.predicted_value,
        ground_truth: p.ground_truth_value,
        sample_id: `sample_${Math.random().toString(36).substr(2, 9)}`
      }));

    return {
      attribute_name: predictions[0]?.attribute_name || '',
      attribute_type: 'text',
      exact_match: exactMatch,
      cer,
      wer,
      sample_errors
    };
  }

  static calculateChecklistMetrics(predictions: AttributePrediction[]): AttributeMetrics {
    // For checklist, we calculate Jaccard similarity and exact match
    let totalJaccard = 0;
    let exactMatches = 0;

    predictions.forEach(p => {
      const pred = new Set(Array.isArray(p.predicted_value) ? p.predicted_value : []);
      const gt = new Set(Array.isArray(p.ground_truth_value) ? p.ground_truth_value : []);
      
      const intersection = new Set([...pred].filter(x => gt.has(x)));
      const union = new Set([...pred, ...gt]);
      
      const jaccard = union.size > 0 ? intersection.size / union.size : 1;
      totalJaccard += jaccard;
      
      if (pred.size === gt.size && [...pred].every(x => gt.has(x))) {
        exactMatches++;
      }
    });

    const meanJaccard = totalJaccard / predictions.length;
    const exactMatch = exactMatches / predictions.length;

    return {
      attribute_name: predictions[0]?.attribute_name || '',
      attribute_type: 'checklist',
      f1_score: meanJaccard, // Using Jaccard as F1 approximation
      exact_match: exactMatch
    };
  }

  // Helper methods
  private static calculateAccuracy(predictions: AttributePrediction[]): number {
    const correct = predictions.filter(p => p.predicted_value === p.ground_truth_value).length;
    return correct / predictions.length;
  }

  private static buildConfusionMatrix(
    predictions: AttributePrediction[], 
    labels: string[]
  ): ConfusionMatrix {
    const matrix = Array(labels.length).fill(0).map(() => Array(labels.length).fill(0));
    
    predictions.forEach(p => {
      const predIndex = labels.indexOf(String(p.predicted_value));
      const gtIndex = labels.indexOf(String(p.ground_truth_value));
      
      if (predIndex >= 0 && gtIndex >= 0) {
        matrix[gtIndex][predIndex]++;
      }
    });

    return {
      labels,
      matrix,
      total_samples: predictions.length
    };
  }

  private static calculatePRF1(confusionMatrix: ConfusionMatrix): {
    precision: number;
    recall: number;
    f1_score: number;
  } {
    const { matrix, labels } = confusionMatrix;
    let totalPrecision = 0;
    let totalRecall = 0;
    let validClasses = 0;

    for (let i = 0; i < labels.length; i++) {
      const tp = matrix[i][i];
      const fp = matrix.reduce((sum, row, j) => sum + (j !== i ? row[i] : 0), 0);
      const fn = matrix[i].reduce((sum, val, j) => sum + (j !== i ? val : 0), 0);

      if (tp + fp > 0 && tp + fn > 0) {
        const precision = tp / (tp + fp);
        const recall = tp / (tp + fn);
        totalPrecision += precision;
        totalRecall += recall;
        validClasses++;
      }
    }

    const avgPrecision = validClasses > 0 ? totalPrecision / validClasses : 0;
    const avgRecall = validClasses > 0 ? totalRecall / validClasses : 0;
    const f1Score = avgPrecision + avgRecall > 0 ? 
      (2 * avgPrecision * avgRecall) / (avgPrecision + avgRecall) : 0;

    return {
      precision: avgPrecision,
      recall: avgRecall,
      f1_score: f1Score
    };
  }

  private static levenshteinDistance(a: any[], b: any[]): number;
  private static levenshteinDistance(a: string, b: string): number;
  private static levenshteinDistance(a: any, b: any): number {
    if (typeof a === 'string' && typeof b === 'string') {
      const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
      
      for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
      
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + indicator
          );
        }
      }
      
      return matrix[b.length][a.length];
    } else {
      // Array version - convert arrays to strings for comparison
      const arrA = Array.isArray(a) ? a : [a];
      const arrB = Array.isArray(b) ? b : [b];
      return this.levenshteinDistance(arrA.map(String).join(' '), arrB.map(String).join(' '));
    }
  }

  // Main evaluation function
  static evaluateAttributes(
    attributeSpecs: AttributeSpec[],
    allPredictions: AttributePrediction[]
  ): {
    perAttributeMetrics: AttributeMetrics[];
    globalMetrics: GlobalAttributeMetrics;
    compositionAnalysis: CompositionAnalysis;
  } {
    const perAttributeMetrics: AttributeMetrics[] = [];
    
    attributeSpecs.forEach(spec => {
      const attributePredictions = allPredictions.filter(
        p => p.attribute_name === spec.name
      );
      
      if (attributePredictions.length === 0) return;
      
      let metrics: AttributeMetrics;
      
      switch (spec.type) {
        case 'categorical':
          metrics = this.calculateCategoricalMetrics(attributePredictions, spec);
          break;
        case 'boolean':
          metrics = this.calculateBooleanMetrics(attributePredictions);
          break;
        case 'numeric':
          metrics = this.calculateNumericMetrics(attributePredictions);
          break;
        case 'text':
          metrics = this.calculateTextMetrics(attributePredictions);
          break;
        case 'checklist':
          metrics = this.calculateChecklistMetrics(attributePredictions);
          break;
        default:
          return;
      }
      
      perAttributeMetrics.push(metrics);
    });

    const globalMetrics = this.calculateGlobalMetrics(perAttributeMetrics, allPredictions);
    const compositionAnalysis = this.calculateCompositionAnalysis(
      attributeSpecs, 
      allPredictions
    );

    return {
      perAttributeMetrics,
      globalMetrics,
      compositionAnalysis
    };
  }

  private static calculateGlobalMetrics(
    perAttributeMetrics: AttributeMetrics[],
    allPredictions: AttributePrediction[]
  ): GlobalAttributeMetrics {
    const f1Scores = perAttributeMetrics
      .map(m => m.f1_score || m.exact_match || 0)
      .filter(score => score !== undefined);
    
    const accuracies = perAttributeMetrics
      .map(m => m.accuracy || m.exact_match || 0)
      .filter(acc => acc !== undefined);

    const attrMacroF1 = f1Scores.length > 0 ? 
      f1Scores.reduce((sum, f1) => sum + f1, 0) / f1Scores.length : 0;
    
    const meanAttributeAccuracy = accuracies.length > 0 ?
      accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length : 0;

    // Calculate joint correctness
    const sampleIds = [...new Set(allPredictions.map(p => 
      `${p.attribute_name}_sample_${Math.floor(Math.random() * 1000)}`
    ))];
    
    const jointCorrectness = this.calculateJointCorrectness(allPredictions);

    return {
      total_attributes: perAttributeMetrics.length,
      total_samples: Math.floor(allPredictions.length / perAttributeMetrics.length),
      attr_macro_f1: attrMacroF1,
      attr_weighted_f1: attrMacroF1, // Simplified
      joint_correctness: jointCorrectness,
      mean_attribute_accuracy: meanAttributeAccuracy,
      attribute_coverage: perAttributeMetrics.length / perAttributeMetrics.length // 100% for mock data
    };
  }

  private static calculateJointCorrectness(allPredictions: AttributePrediction[]): number {
    // Group predictions by sample (simplified for mock data)
    const sampleGroups: { [key: string]: AttributePrediction[] } = {};
    
    allPredictions.forEach(pred => {
      const sampleId = `sample_${Math.floor(Math.random() * 100)}`;
      if (!sampleGroups[sampleId]) {
        sampleGroups[sampleId] = [];
      }
      sampleGroups[sampleId].push(pred);
    });

    let correctSamples = 0;
    const totalSamples = Object.keys(sampleGroups).length;

    Object.values(sampleGroups).forEach(samplePreds => {
      const allCorrect = samplePreds.every(p => p.predicted_value === p.ground_truth_value);
      if (allCorrect) correctSamples++;
    });

    return totalSamples > 0 ? correctSamples / totalSamples : 0;
  }

  private static calculateCompositionAnalysis(
    attributeSpecs: AttributeSpec[],
    allPredictions: AttributePrediction[]
  ): CompositionAnalysis {
    const jointCorrectness = this.calculateJointCorrectness(allPredictions);
    
    // Mock composition analysis data
    const partialCorrectnessDistribution = {
      "0_correct": 0.05,
      "1_correct": 0.15,
      "2_correct": 0.25,
      "3_correct": 0.30,
      "all_correct": jointCorrectness
    };

    const topFailurePatterns = [
      {
        pattern: "Color + Material misclassification",
        frequency: 0.35,
        example_attributes: ["color", "material"]
      },
      {
        pattern: "Size estimation errors",
        frequency: 0.28,
        example_attributes: ["width", "height", "size_category"]
      },
      {
        pattern: "Text recognition failures",
        frequency: 0.22,
        example_attributes: ["text_content", "language"]
      }
    ];

    const attributeCorrelationErrors = [
      {
        attr1: "color",
        attr2: "material",
        correlation_score: 0.65,
        joint_error_rate: 0.23
      },
      {
        attr1: "size_category",
        attr2: "width",
        correlation_score: 0.78,
        joint_error_rate: 0.18
      }
    ];

    return {
      joint_correctness: jointCorrectness,
      partial_correctness_distribution: partialCorrectnessDistribution,
      top_failure_patterns: topFailurePatterns,
      attribute_correlation_errors: attributeCorrelationErrors
    };
  }
}