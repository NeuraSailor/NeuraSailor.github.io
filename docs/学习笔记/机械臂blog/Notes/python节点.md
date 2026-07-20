#### 节点内容                                         

```python
import rclpy  
from rclpy.node import Node  

def main():  
    rclpy.init()    
    node = Node('python_node')    #节点名：python_node，不能为中文
    node.get_logger().info('Hello from Python ROS2 Node!')  #日志打印
    node.get_logger().warn('This is a warning message.')  
    rclpy.spin(node)  #ROS2启动，持续运行
    rclpy.shutdown()  
    
if __name__ == '__main__':  #用来判断当前模块是否被直接执行
    main()  
```

#### 直接运行节点  

`Python3 ros2_python_node.py  `  
