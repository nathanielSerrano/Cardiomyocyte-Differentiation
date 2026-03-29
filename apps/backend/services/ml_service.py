"""
This module provides a service for interacting with the machine learning model used for predicting hiPSC-CM morphology.
It includes functions for loading the model, preprocessing input data, and making predictions / generating heatmaps.
The model will be a pre-trained ResNet architecture fine-tuned on our cardiomyocyte dataset. We will use PyTorch for model handling and inference.
"""