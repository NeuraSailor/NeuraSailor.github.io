创建实例：

![|500](https://gitee.com/zjuwzy/obsidian_picture/raw/master/20250909212509866.png)

继承：

```python
from demo_python_pkg.person_node import PersonNode  #从person_node节点导入PersonNode类

class WriterNode(PersonNode):  #定义类,继承PersonNode类
    def __init__(self,name:str,age:int,book:str) -> None:  #定义方法(返回值是None)
        self.book = book
        super().__init__(name,age)  #调用父类的构造方法
        print(f"我是{self.name},{self.age}岁,我写了一本书，书名叫{self.book}")

def main():
    node = WriterNode("zhangsan",18,"Python从入门到放弃")
    node.eat("红烧肉")  #调用父类的方法
```

特别的，对于节点，需要从 Node 中继承属性

```python
import rclpy  #导入rclpy模块    
from rclpy.node import Node  #从rclpy.node模块导入Node类
class PersonNode(Node):  #定义类,PersonNode继承Node
    def __init__(self,node_name:str,name:str,age:int) -> None:  #定义方法(返回值是None)
        super().__init__(node_name)   #节点名为PersonNode传入的第一个参数
        self.name = name
        self.age = age

    def eat(self,food_name:str ):  #定义方法
        print (f"{self.name},{self.age}岁，爱吃{food_name}")
        self.get_logger().info(f"{self.name},{self.age}岁，爱吃{food_name}")


def main():
    rclpy.init()  #3个rclpy是ros2 节点的基本格式
    node = PersonNode("章三","张三",18)
    node.eat('鱼香肉丝')
    rclpy.spin(node)
    rclpy.shutdown()
```
